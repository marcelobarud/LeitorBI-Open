import asyncio
import json
from copy import deepcopy

import pytest
from fastapi import HTTPException, Response
from openpyxl import load_workbook
from starlette.requests import Request

from app.demo_data import DEMO_MODEL, DEMO_MODEL_PATH
from app.main import analyze_model, compare_model_exports, export_excel
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


def make_request(method: str = "GET", origin: str | None = None, referer: str | None = None, request_id: str | None = None) -> Request:
    headers = []
    if origin:
        headers.append((b"origin", origin.encode()))
    if referer:
        headers.append((b"referer", referer.encode()))
    if request_id:
        headers.append((b"x-request-id", request_id.encode()))
    return Request({"type": "http", "method": method, "path": "/", "headers": headers, "client": ("127.0.0.1", 50000)})


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
    assert all(row["Tabela"] != "LocalDateTable_123" for row in PowerBIAnalyzer(data).full_report()["tables"])


def test_compare_models_reports_measure_column_and_relationship_changes():
    base = deepcopy(DEMO_MODEL)
    new = deepcopy(DEMO_MODEL)
    new["dashboardName"] = "Demo Comercial v2"
    new["tables"][0]["measures"][0]["expression"] = "SUM('Fato Vendas Demo'[Receita]) * 1.1"
    new["tables"][0]["measures"].append({"name": "Receita Nova", "expression": "SUM('Fato Vendas Demo'[Receita Nova])"})
    new["tables"][0]["columns"][5]["formatString"] = "R$ #,0"
    new["relationships"][0]["crossFilteringBehavior"] = "BothDirections"
    result = compare_models(base, new)
    response = CompareResponse.model_validate(result)
    assert result["dashboard_novo"] == "Demo Comercial v2"
    assert response.medidas.adicionadas[0].expressao_dax == "SUM('Fato Vendas Demo'[Receita Nova])"
    assert result["medidas"]["modificadas"][0]["medida"] == "Receita Total"
    assert result["colunas"]["modificadas"][0]["coluna"] == "Receita"
    assert result["relacionamentos"]["modificados"][0]["relacionamento"] == "Fato Vendas Demo.Id Produto -> Dim Produto Demo.Id Produto"


def test_build_excel_includes_expected_sheets():
    workbook = load_workbook(build_excel(PowerBIAnalyzer(DEMO_MODEL).full_report()))
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


def test_read_json_upload_rejects_non_json_empty_and_large_files(monkeypatch):
    for upload in (FakeUpload("modelo.txt", b"{}"), FakeUpload("modelo.json", b"")):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(read_json_upload(upload))
        assert exc.value.status_code == 400

    monkeypatch.setenv("LEITORBI_MAX_UPLOAD_MB", "1")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_json_upload(FakeUpload("modelo.json", b" " * (1024 * 1024 + 1))))
    assert exc.value.status_code == 413


@pytest.mark.parametrize("table", [{}, {"name": "  "}])
def test_validate_model_export_rejects_table_without_name(table):
    with pytest.raises(HTTPException) as exc:
        validate_model_export({"tables": [table]})
    assert exc.value.status_code == 422


def test_request_observability_adds_request_id_and_logs(caplog):
    async def call_next(_request: Request) -> Response:
        return Response(status_code=204)

    request = make_request(request_id="teste-request-id")
    with caplog.at_level("INFO", logger="leitorbi.api"):
        response = asyncio.run(log_http_request(request, call_next))
    assert response.headers["X-Request-ID"] == "teste-request-id"
    records = [record for record in caplog.records if record.name == "leitorbi.api"]
    assert records[-1].message == "request_completed"
    assert records[-1].request_id == "teste-request-id"
    assert records[-1].status_code == 204


def test_public_mutations_still_validate_origin(monkeypatch):
    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "http://localhost:5173")
    assert_safe_origin(make_request(method="POST", origin="http://localhost:5173"))
    with pytest.raises(HTTPException) as exc:
        assert_safe_origin(make_request(method="POST", origin="https://evil.example"))
    assert exc.value.status_code == 403


def test_origin_requirement_and_cors_configuration(monkeypatch):
    monkeypatch.setenv("LEITORBI_REQUIRE_ORIGIN", "true")
    with pytest.raises(HTTPException) as exc:
        assert_safe_origin(make_request(method="POST"))
    assert exc.value.status_code == 403

    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "*")
    assert cors_origins() == ["*"]
    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "*,http://localhost:5173")
    with pytest.raises(RuntimeError):
        cors_origins()


def test_production_security_requires_explicit_cors_but_not_session_settings(monkeypatch):
    monkeypatch.setenv("LEITORBI_ENV", "production")
    monkeypatch.delenv("LEITORBI_CORS_ORIGINS", raising=False)
    with pytest.raises(RuntimeError):
        validate_security_config()
    monkeypatch.setenv("LEITORBI_CORS_ORIGINS", "https://leitorbi.example")
    validate_security_config()


def test_model_operations_are_public_without_cookies():
    payload = json.dumps(DEMO_MODEL).encode()
    analyzed = asyncio.run(analyze_model(FakeUpload("modelo.json", payload)))
    compared = asyncio.run(compare_model_exports(FakeUpload("base.json", payload), FakeUpload("novo.json", payload)))
    exported = asyncio.run(export_excel(FakeUpload("modelo.json", payload)))
    assert analyzed.raw.dashboardName == "Demo Publica Comercial"
    assert compared.dashboard_base == "Demo Publica Comercial"
    assert exported.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
