from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel


SESSION_COOKIE_NAME = "leitorbi_session"
SESSION_SECONDS = 8 * 60 * 60
LOGIN_WINDOW_SECONDS = 5 * 60
LOGIN_MAX_ATTEMPTS = 5
PASSWORD_SCHEME = "scrypt"
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LENGTH = 32

router = APIRouter(prefix="/api/auth", tags=["auth"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])
_login_attempts: dict[str, list[float]] = {}


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    email: str
    is_admin: bool


class AdminUserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool
    disabled: bool
    created_at: str


class CreateUserRequest(BaseModel):
    email: str
    password: str
    is_admin: bool = False


class UpdateUserRequest(BaseModel):
    is_admin: bool | None = None
    disabled: bool | None = None


@dataclass(frozen=True)
class AuthenticatedUser:
    id: int
    email: str
    is_admin: bool


def utc_now() -> datetime:
    return datetime.now(UTC)


def utc_now_text() -> str:
    return utc_now().isoformat()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def auth_db_path() -> Path:
    configured = os.getenv("LEITORBI_AUTH_DB")
    if configured:
        return Path(configured).expanduser()
    return Path(__file__).resolve().parents[1] / ".data" / "auth.sqlite3"


def session_cookie_secure() -> bool:
    return os.getenv("LEITORBI_SESSION_SECURE", "").strip().lower() in {"1", "true", "yes", "on"}


def connect_db() -> sqlite3.Connection:
    path = auth_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_auth() -> None:
    with connect_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                disabled INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_seen_at TEXT,
                revoked_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
            """
        )
        seed_admin(connection)


def seed_admin(connection: sqlite3.Connection) -> None:
    email = os.getenv("LEITORBI_ADMIN_EMAIL")
    password = os.getenv("LEITORBI_ADMIN_PASSWORD")
    if not email or not password:
        return

    normalized_email = normalize_email(email)
    existing = connection.execute("SELECT id FROM users WHERE email = ?", (normalized_email,)).fetchone()
    if existing:
        return

    connection.execute(
        """
        INSERT INTO users (email, password_hash, is_admin, disabled, created_at)
        VALUES (?, ?, 1, 0, ?)
        """,
        (normalized_email, hash_password(password), utc_now_text()),
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=KEY_LENGTH,
    )
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii")
    key_text = base64.urlsafe_b64encode(key).decode("ascii")
    return f"{PASSWORD_SCHEME}${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt_text}${key_text}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, n_text, r_text, p_text, salt_text, key_text = stored_hash.split("$")
        if scheme != PASSWORD_SCHEME:
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode("ascii"))
        expected = base64.urlsafe_b64decode(key_text.encode("ascii"))
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n_text),
            r=int(r_text),
            p=int(p_text),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


_DUMMY_PASSWORD_HASH = hash_password("invalid-password")


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def rate_limit_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{normalize_email(email)}"


def assert_login_allowed(request: Request, email: str) -> None:
    key = rate_limit_key(request, email)
    now = monotonic()
    attempts = [attempt for attempt in _login_attempts.get(key, []) if now - attempt < LOGIN_WINDOW_SECONDS]
    _login_attempts[key] = attempts
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        )


def record_failed_login(request: Request, email: str) -> None:
    key = rate_limit_key(request, email)
    _login_attempts.setdefault(key, []).append(monotonic())


def clear_failed_logins(request: Request, email: str) -> None:
    _login_attempts.pop(rate_limit_key(request, email), None)


def invalid_login() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais invalidas.")


def create_session(connection: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(48)
    now = utc_now()
    expires_at = now + timedelta(seconds=SESSION_SECONDS)
    connection.execute(
        """
        INSERT INTO sessions (user_id, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, token_hash(token), now.isoformat(), expires_at.isoformat()),
    )
    return token


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=session_cookie_secure(),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/", samesite="lax", secure=session_cookie_secure())


def user_response(user: AuthenticatedUser) -> UserResponse:
    return UserResponse(email=user.email, is_admin=user.is_admin)


def load_user_by_session(token: str) -> AuthenticatedUser | None:
    now = utc_now_text()
    with connect_db() as connection:
        row = connection.execute(
            """
            SELECT users.id, users.email, users.is_admin
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
              AND sessions.revoked_at IS NULL
              AND sessions.expires_at > ?
              AND users.disabled = 0
            """,
            (token_hash(token), now),
        ).fetchone()
        if not row:
            return None
        connection.execute(
            "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
            (now, token_hash(token)),
        )
        return AuthenticatedUser(id=row["id"], email=row["email"], is_admin=bool(row["is_admin"]))


def current_user(request: Request) -> AuthenticatedUser:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticacao necessaria.")

    user = load_user_by_session(token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao invalida ou expirada.")
    return user


def current_admin_user(user: AuthenticatedUser = Depends(current_user)) -> AuthenticatedUser:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores.")
    return user


def validate_user_payload(email: str, password: str | None = None) -> str:
    normalized_email = normalize_email(email)
    if "@" not in normalized_email or "." not in normalized_email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Informe um e-mail valido.")
    if password is not None and len(password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A senha deve ter pelo menos 8 caracteres.")
    return normalized_email


def admin_user_response(row: sqlite3.Row) -> AdminUserResponse:
    return AdminUserResponse(
        id=row["id"],
        email=row["email"],
        is_admin=bool(row["is_admin"]),
        disabled=bool(row["disabled"]),
        created_at=row["created_at"],
    )


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, request: Request, response: Response) -> UserResponse:
    email = normalize_email(payload.email)
    assert_login_allowed(request, email)

    with connect_db() as connection:
        row = connection.execute(
            "SELECT id, email, password_hash, is_admin FROM users WHERE email = ? AND disabled = 0",
            (email,),
        ).fetchone()
        stored_hash = row["password_hash"] if row else _DUMMY_PASSWORD_HASH
        if not verify_password(payload.password, stored_hash) or not row:
            record_failed_login(request, email)
            raise invalid_login()

        token = create_session(connection, row["id"])
        clear_failed_logins(request, email)
        set_session_cookie(response, token)
        return UserResponse(email=row["email"], is_admin=bool(row["is_admin"]))


@router.get("/me", response_model=UserResponse)
def me(user: AuthenticatedUser = Depends(current_user)) -> UserResponse:
    return user_response(user)


@router.post("/logout")
def logout(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        with connect_db() as connection:
            connection.execute(
                """
                UPDATE sessions
                SET revoked_at = ?
                WHERE token_hash = ? AND revoked_at IS NULL
                """,
                (utc_now_text(), token_hash(token)),
            )
    clear_session_cookie(response)
    return {"status": "ok"}


@admin_router.get("/users", response_model=list[AdminUserResponse])
def list_users(_admin: AuthenticatedUser = Depends(current_admin_user)) -> list[AdminUserResponse]:
    with connect_db() as connection:
        rows = connection.execute(
            """
            SELECT id, email, is_admin, disabled, created_at
            FROM users
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
        return [admin_user_response(row) for row in rows]


@admin_router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    _admin: AuthenticatedUser = Depends(current_admin_user),
) -> AdminUserResponse:
    email = validate_user_payload(payload.email, payload.password)

    try:
        with connect_db() as connection:
            connection.execute(
                """
                INSERT INTO users (email, password_hash, is_admin, disabled, created_at)
                VALUES (?, ?, ?, 0, ?)
                """,
                (email, hash_password(payload.password), int(payload.is_admin), utc_now_text()),
            )
            row = connection.execute(
                """
                SELECT id, email, is_admin, disabled, created_at
                FROM users
                WHERE email = ?
                """,
                (email,),
            ).fetchone()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Usuario ja cadastrado.") from exc

    if row is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Usuario criado, mas nao localizado.")
    return admin_user_response(row)


@admin_router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    admin: AuthenticatedUser = Depends(current_admin_user),
) -> AdminUserResponse:
    if payload.is_admin is None and payload.disabled is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Informe ao menos uma alteracao.")
    if user_id == admin.id and payload.disabled is True:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voce nao pode desativar seu proprio usuario.")
    if user_id == admin.id and payload.is_admin is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voce nao pode remover seu proprio perfil admin.")

    updates: list[str] = []
    params: list[int] = []
    if payload.is_admin is not None:
        updates.append("is_admin = ?")
        params.append(int(payload.is_admin))
    if payload.disabled is not None:
        updates.append("disabled = ?")
        params.append(int(payload.disabled))

    with connect_db() as connection:
        row = connection.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")

        connection.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            (*params, user_id),
        )
        updated = connection.execute(
            """
            SELECT id, email, is_admin, disabled, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    return admin_user_response(updated)
