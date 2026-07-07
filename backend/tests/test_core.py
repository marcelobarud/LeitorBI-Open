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
    LoginRequest,
    _login_attempts,
    current_user,
    init_auth,
    login,
    logout,
)
from app.demo_data import DEMO_MODEL, DEMO_MODEL_PATH
from app.services.analyzer import PowerBIAnalyzer
from app.services.compare import compare_models
from app.services.excel_export import build_excel
from app.upload_validation import read_json_upload, validate_model_export


class FakeUpload:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self) -> bytes:
        return self._content


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
    new["tables"][0]["columns"][5]["formatString"] = "R$ #,0"
    new["relationships"][0]["crossFilteringBehavior"] = "BothDirections"

    result = compare_models(base, new)

    assert result["dashboard_novo"] == "Demo Comercial v2"
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


def make_request(cookie_header: str | None = None) -> Request:
    headers = []
    if cookie_header:
        headers.append((b"cookie", cookie_header.encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": headers,
            "client": ("127.0.0.1", 50000),
        }
    )


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


def test_login_valid_creates_cookie_and_allows_protected_dependency(monkeypatch, tmp_path):
    db_path = auth_db(monkeypatch, tmp_path)

    login_response, cookie_header = login_cookie()
    user = current_user(make_request(cookie_header))

    assert SESSION_COOKIE_NAME in login_response.headers["set-cookie"]
    assert user.email == "admin@leitorbi.local"
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
