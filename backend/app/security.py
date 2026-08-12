import os
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, status


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
TRUE_VALUES = {"1", "true", "yes", "on"}


def is_production() -> bool:
    return os.getenv("LEITORBI_ENV", "development").strip().lower() == "production"


def environment_flag(name: str) -> bool | None:
    value = os.getenv(name)
    if value is None or not value.strip():
        return None
    return value.strip().lower() in TRUE_VALUES


def cors_origins() -> list[str]:
    configured = os.getenv("LEITORBI_CORS_ORIGINS")
    if not configured:
        if is_production():
            raise RuntimeError("LEITORBI_CORS_ORIGINS deve ser configurado em produção.")
        return DEFAULT_CORS_ORIGINS

    origins = [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    if not origins:
        raise RuntimeError("LEITORBI_CORS_ORIGINS deve conter ao menos uma origem válida.")
    if "*" in origins and len(origins) > 1:
        raise RuntimeError("LEITORBI_CORS_ORIGINS não pode combinar '*' com outras origens.")
    if origins == ["*"]:
        return origins
    if any(origin != origin_from_url(origin) or not origin.startswith(("http://", "https://")) for origin in origins):
        raise RuntimeError("LEITORBI_CORS_ORIGINS deve conter apenas origens HTTP(S), sem caminho.")
    return origins


def origin_from_url(value: str) -> str:
    parsed = urlsplit(value)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def allowed_request_origins() -> set[str]:
    return set(cors_origins())


def require_request_origin() -> bool:
    configured = environment_flag("LEITORBI_REQUIRE_ORIGIN")
    return is_production() if configured is None else configured


def validate_security_config() -> None:
    cors_origins()


def assert_safe_origin(request: Request) -> None:
    if request.method.upper() not in UNSAFE_METHODS:
        return

    allowed_origins = allowed_request_origins()
    origin = request.headers.get("origin")
    if origin:
        if origin.rstrip("/") not in allowed_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Origem da requisição não autorizada.",
            )
        return

    referer = request.headers.get("referer")
    if referer:
        referer_origin = origin_from_url(referer)
        if referer_origin not in allowed_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Origem da requisição não autorizada.",
            )
        return

    if require_request_origin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Origem da requisição obrigatória.",
        )
