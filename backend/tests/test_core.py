import asyncio
import sqlite3
from copy import deepcopy
from http.cookies import SimpleCookie

import pytest
from fastapi import HTTPException, Response
from openpyxl import load_workbook
from starlette.requests import Request

from app.auth import (
    SESSION_COOKIE_NAME,
    CreateUserRequest,
    LoginRequest,
    RegisterRequest,
    UpdateUserRequest,
    _login_attempts,
    create_user,
    connect_db,
    current_user,
    current_admin_user,
    delete_user,
    ensure_active_admin_remains,
    init_auth,
    list_users,
    login,
    logout,
    register,
    session_cookie_secure,
    update_user,
)
from app.demo_data import DEMO_MODEL, DEMO_MODEL_PATH
from app.observability import log_http_request
from app.security import assert_safe_origin, cors_origins, validate_security_config
from app.schemas import CompareResponse
from app.services.analyzer import PowerBIAnalyzer
from app.services.compare import compare_models
from app.services.excel_export import build_excel
from app.upload_validation import read_json_upload, validate_model_export


class FakeUpload:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content
        self._position = 0

    async def read(self, size: int = -1) -> bytes:
        if size < 0:
            result = self._content[self._position:]
            self._position = len(self._content)
            return result
        result = self._content[self._position:self._position + size]
        self._position += len(result)
        return result


def test_analyzer_demo_report_has_expected_sections():
    report = PowerBIAnalyzer(DEMO_MODEL).full_report()

    assert DEMO_MODEL_PATH.name == "public_demo_model.json"
    assert report["summary"]["Dashboard"] == "Demo Publica Comercial"
    assert report["summary"]["Tabelas totais"] == 5
    assert "SQL" in report["summary"]["Tipos de fontes"]
    assert "Excel" in report["summary"]["Tipos de fontes"]
    assert "SharePoint" in report["summary"]["Tipos de fontes"]
    assert report["sources"][0]["Servidor"] == "demo-sql-server"
    assert report["relationships"][-1]["Ativo"] == "Não"
    assert "quality" not in report


def test_analyzer_filters_technical_date_tables():
    data = deepcopy(DEMO_MODEL)
    data["tables"].append({"name": "LocalDateTable_123", "columns": [{"name": "Date"}]})

    report = PowerBIAnalyzer(data).full_report()

    assert all(row["Tabela"] != "LocalDateTable_123" for row in report["tables"])


def test_compare_models_reports_measure_column_and_relationship_changes():
    base = deepcopy(DEMO_MODEL)
    new = deepcopy(DEMO_MODEL)
    new["dashboardName"] = "Demo Comercial v2"
    new["tables"][0]["measures"][0]["expression"] = "SUM('Fato Vendas Demo'[Receita]) * 1.1"
    new["tables"][0]["measures"].append({
        "name": "Receita Nova",
        "expression": "SUM('Fato Vendas Demo'[Receita Nova])",
    })
    new["tables"][0]["columns"][5]["formatString"] = "R$ #,0"
    new["relationships"][0]["crossFilteringBehavior"] = "BothDirections"

    result = compare_models(base, new)
    response = CompareResponse.model_validate(result)

    assert result["dashboard_novo"] == "Demo Comercial v2"
    assert result["medidas"]["adicionadas"][0]["expressao_dax"] == "SUM('Fato Vendas Demo'[Receita Nova])"
    assert response.medidas.adicionadas[0].expressao_dax == "SUM('Fato Vendas Demo'[Receita Nova])"
    assert result["medidas"]["modificadas"][0]["medida"] == "Receita Total"
    assert result["colunas"]["modificadas"][0]["coluna"] == "Receita"
    assert result["relacionamentos"]["modificados"][0]["relacionamento"] == (
        "Fato Vendas Demo.Id Produto -> Dim Produto Demo.Id Produto"
    )


def test_build_excel_includes_expected_sheets():
    report = PowerBIAnalyzer(DEMO_MODEL).full_report()
    workbook = load_workbook(build_excel(report))

    assert "Resumo" in workbook.sheetnames
    assert "Qualidade" not in workbook.sheetnames
    assert "Colunas em Medidas" in workbook.sheetnames
    assert workbook["Resumo"]["A1"].value == "Indicador"


def test_validate_model_export_rejects_missing_tables():
    with pytest.raises(HTTPException) as exc:
        validate_model_export({"dashboardName": "Sem tabelas"})

    assert exc.value.status_code == 422
    assert "tables" in exc.value.detail


def test_read_json_upload_rejects_invalid_json():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_json_upload(FakeUpload("modelo.json", b"{invalid")))

    assert exc.value.status_code == 400
    assert "JSON inválido" in exc.value.detail


def test_read_json_upload_rejects_non_json_extension():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_json_upload(FakeUpload("modelo.txt", b"{}")))

    assert exc.value.status_code == 400


def test_read_json_upload_rejects_empty_file():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_json_upload(FakeUpload("modelo.json", b"")))

    assert exc.value.status_code == 400
    assert "Arquivo vazio" in exc.value.detail


def test_read_json_upload_rejects_file_larger_than_limit(monkeypatch):
    monkeypatch.setenv("LEITORBI_MAX_UPLOAD_MB", "1")
    content = b" " * (1024 * 1024 + 1)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_json_upload(FakeUpload("modelo.json", content)))

    assert exc.value.status_code == 413


@pytest.mark.parametrize("table", [{}, {"name": "  "}])
def test_validate_model_export_rejects_table_without_name(table):
    with pytest.raises(HTTPException) as exc:
        validate_model_export({"tables": [table]})

    assert exc.value.status_code == 422


def make_request(
    cookie_header: str | None = None,
    method: str = "GET",
    origin: str | None = None,
    referer: str | None = None,
    request_id: str | None = None,
) -> Request:
    headers = []
    if cookie_header:
        headers.append((b"cookie", cookie_header.encode("utf-8")))
    if origin:
        headers.append((b"origin", origin.encode("utf-8")))
    if referer:
        headers.append((b"referer", referer.encode("utf-8")))
    if request_id:
        headers.append((b"x-request-id", request_id.encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": method,
            "path": "/",
            "headers": headers,
            "client": ("127.0.0.1", 50000),
        }
    )


def test_request_observability_adds_request_id_and_logs(caplog):
    async def call_next(_request: Request) -> Response:
        return Response(status_code=204)

    request = make_request(request_id="teste-request-id")

    with caplog.at_level("INFO", logger="leitorbi.api"):
        response = asyncio.run(log_http_request(request, call_next))

    assert response.headers["X-Request-ID"] == "teste-request-id"
    records = [record for record in caplog.records if record.name == "leitorbi.api"]
    assert records
    assert records[-1].message == "request_completed"
    assert records[-1].request_id == "teste-request-id"
    assert records[-1].status_code == 204
    assert records[-1].path == "/"


def auth_db(monkeypatch: pytest.MonkeyPatch, tmp_path):
    db_path = tmp_path / "auth.sqlite3"
    monkeypatch.setenv("LEITORBI_AUTH_DB", str(db_path))
    monkeypatch.setenv("LEITORBI_ADMIN_EMAIL", "admin@leitorbi.local")
    monkeypatch.setenv("LEITORBI_ADMIN_PASSWORD", "SenhaForte123!")
    monkeypatch.delenv("LEITORBI_SESSION_SECURE", raising=False)
    _login_attempts.clear()
    init_auth()
    return db_path


def login_cookie() -> tuple[Response, str]:
    response = Response()
    login(
        LoginRequest(email="admin@leitorbi.local", password="SenhaForte123!"),
        make_request(),
        response,
    )
    cookies = SimpleCookie()
    cookies.load(response.headers["set-cookie"])
    token = cookies[SESSION_COOKIE_NAME].value
    return response, f"{SESSION_COOKIE_NAME}={token}"


def test_protected_dependency_requires_session(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)

    with pytest.raises(HTTPException) as exc:
        current_user(make_request())

    assert exc.value.status_code == 401


def test_unsafe_request_origin_must_be_allowed(monkeypatch):
    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "http://localhost:5173")

    assert_safe_origin(make_request(method="POST", origin="http://localhost:5173"))

    with pytest.raises(HTTPException) as exc:
        assert_safe_origin(make_request(method="POST", origin="https://evil.example"))

    assert exc.value.status_code == 403


def test_unsafe_request_allows_valid_referer_when_origin_absent(monkeypatch):
    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "http://localhost:5173")

    assert_safe_origin(make_request(method="POST", referer="http://localhost:5173/app"))


def test_unsafe_request_without_origin_is_rejected_when_required(monkeypatch):
    monkeypatch.setenv("LEITORBI_REQUIRE_ORIGIN", "true")

    with pytest.raises(HTTPException) as exc:
        assert_safe_origin(make_request(method="POST"))

    assert exc.value.status_code == 403


def test_cors_origins_rejects_wildcard_with_credentials(monkeypatch):
    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "*")

    with pytest.raises(RuntimeError):
        cors_origins()


def test_production_security_config_requires_cors_and_secure_cookie(monkeypatch):
    monkeypatch.setenv("LEITORBI_ENV", "production")
    monkeypatch.delenv("LEITORBI_CORS_ORIGINS", raising=False)
    monkeypatch.delenv("LEITORBI_SESSION_SECURE", raising=False)

    with pytest.raises(RuntimeError):
        validate_security_config()

    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "https://leitorbi.example")
    monkeypatch.setenv("LEITORBI_SESSION_SECURE", "true")
    validate_security_config()
    assert session_cookie_secure() is True


def test_login_valid_creates_cookie_and_allows_protected_dependency(monkeypatch, tmp_path):
    db_path = auth_db(monkeypatch, tmp_path)

    login_response, cookie_header = login_cookie()
    user = current_user(make_request(cookie_header))

    assert SESSION_COOKIE_NAME in login_response.headers["set-cookie"]
    assert user.email == "admin@leitorbi.local"
    assert user.name == "Administrador"
    assert user.is_admin is True

    with sqlite3.connect(db_path) as connection:
        user_row = connection.execute("SELECT password_hash FROM users WHERE email = ?", ("admin@leitorbi.local",)).fetchone()
        session_row = connection.execute("SELECT token_hash FROM sessions").fetchone()

    assert user_row is not None
    assert user_row[0] != "SenhaForte123!"
    assert "SenhaForte123!" not in user_row[0]
    assert session_row is not None
    assert session_row[0] not in login_response.headers["set-cookie"]


def test_login_invalid_is_generic_and_does_not_create_session(monkeypatch, tmp_path):
    db_path = auth_db(monkeypatch, tmp_path)

    with pytest.raises(HTTPException) as wrong_password:
        login(
            LoginRequest(email="admin@leitorbi.local", password="senha-errada"),
            make_request(),
            Response(),
        )
    with pytest.raises(HTTPException) as unknown_user:
        login(
            LoginRequest(email="naoexiste@leitorbi.local", password="senha-errada"),
            make_request(),
            Response(),
        )

    assert wrong_password.value.status_code == 401
    assert wrong_password.value.detail == "Credenciais invalidas."
    assert unknown_user.value.status_code == wrong_password.value.status_code
    assert unknown_user.value.detail == wrong_password.value.detail

    with sqlite3.connect(db_path) as connection:
        session_count = connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]

    assert session_count == 0


def test_logout_invalidates_session(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)

    login_response, cookie_header = login_cookie()
    logout_response = Response()
    logout(make_request(cookie_header), logout_response)

    assert SESSION_COOKIE_NAME in login_response.headers["set-cookie"]
    with pytest.raises(HTTPException) as exc:
        current_user(make_request(cookie_header))

    assert exc.value.status_code == 401


def test_admin_can_manage_users(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)
    _, cookie_header = login_cookie()
    admin = current_user(make_request(cookie_header))

    created = create_user(
        CreateUserRequest(email="analista@leitorbi.local", password="SenhaForte123!", is_admin=False),
        admin,
    )
    users = list_users(admin)
    updated = update_user(created.id, UpdateUserRequest(disabled=True), admin)

    assert created.email == "analista@leitorbi.local"
    assert created.is_admin is False
    assert created.disabled is False
    assert any(user.email == "analista@leitorbi.local" for user in users)
    assert updated.disabled is True


def test_public_registration_creates_non_admin_without_session(monkeypatch, tmp_path):
    db_path = auth_db(monkeypatch, tmp_path)

    created = register(RegisterRequest(name="Ana Souza", email="ANA@LeitorBI.Local", password="SenhaForte123!"))

    assert created.name == "Ana Souza"
    assert created.email == "ana@leitorbi.local"
    assert created.is_admin is False
    with sqlite3.connect(db_path) as connection:
        user_row = connection.execute(
            "SELECT name, password_hash, is_admin FROM users WHERE email = ?",
            ("ana@leitorbi.local",),
        ).fetchone()
        session_count = connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]

    assert user_row is not None
    assert user_row[0] == "Ana Souza"
    assert user_row[1] != "SenhaForte123!"
    assert user_row[2] == 0
    assert session_count == 0


def test_registration_rejects_duplicate_email(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)

    register(RegisterRequest(name="Ana Souza", email="ana@leitorbi.local", password="SenhaForte123!"))

    with pytest.raises(HTTPException) as exc:
        register(RegisterRequest(name="Ana Souza", email="ana@leitorbi.local", password="SenhaForte123!"))

    assert exc.value.status_code == 409


def test_admin_can_delete_user_but_not_self_or_last_admin(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)
    _, cookie_header = login_cookie()
    admin = current_user(make_request(cookie_header))
    regular = create_user(
        CreateUserRequest(name="Analista", email="analista@leitorbi.local", password="SenhaForte123!", is_admin=False),
        admin,
    )

    response = delete_user(regular.id, admin)

    assert response.status_code == 204
    assert all(user.id != regular.id for user in list_users(admin))
    with pytest.raises(HTTPException) as self_delete:
        delete_user(admin.id, admin)
    assert self_delete.value.status_code == 400

    other_admin = create_user(
        CreateUserRequest(name="Admin Dois", email="admin2@leitorbi.local", password="SenhaForte123!", is_admin=True),
        admin,
    )
    delete_user(other_admin.id, admin)

    assert all(user.id != other_admin.id for user in list_users(admin))
    assert any(user.id == admin.id for user in list_users(admin))


def test_non_admin_cannot_access_admin_dependency(monkeypatch, tmp_path):
    db_path = auth_db(monkeypatch, tmp_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO users (name, email, password_hash, is_admin, disabled, created_at)
            VALUES (?, ?, ?, 0, 0, ?)
            """,
            ("Analista", "analista@leitorbi.local", "hash", "2026-07-09T00:00:00+00:00"),
        )
        user_id = connection.execute("SELECT id FROM users WHERE email = ?", ("analista@leitorbi.local",)).fetchone()[0]

    with pytest.raises(HTTPException) as exc:
        current_admin_user(type("User", (), {"id": user_id, "email": "analista@leitorbi.local", "is_admin": False})())

    assert exc.value.status_code == 403


def test_admin_cannot_disable_self(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)
    _, cookie_header = login_cookie()
    admin = current_user(make_request(cookie_header))

    with pytest.raises(HTTPException) as exc:
        update_user(admin.id, UpdateUserRequest(disabled=True), admin)

    assert exc.value.status_code == 400


def test_active_admin_invariant_requires_another_active_admin(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)
    _, cookie_header = login_cookie()
    admin = current_user(make_request(cookie_header))

    with pytest.raises(HTTPException) as exc:
        with connect_db() as connection:
            ensure_active_admin_remains(connection, admin.id)

    assert exc.value.status_code == 400


def test_active_admin_invariant_allows_change_when_another_admin_remains(monkeypatch, tmp_path):
    auth_db(monkeypatch, tmp_path)
    _, cookie_header = login_cookie()
    admin = current_user(make_request(cookie_header))
    other_admin = create_user(
        CreateUserRequest(name="Admin Dois", email="admin2@leitorbi.local", password="SenhaForte123!", is_admin=True),
        admin,
    )

    with connect_db() as connection:
        ensure_active_admin_remains(connection, other_admin.id)
