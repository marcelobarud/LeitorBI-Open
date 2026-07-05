import asyncio
from copy import deepcopy

import pytest
from fastapi import HTTPException
from openpyxl import load_workbook

from app.demo_data import DEMO_MODEL
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

    assert report["summary"]["Dashboard"] == "Demo Comercial"
    assert report["summary"]["Tabelas totais"] == 4
    assert "SQL" in report["summary"]["Tipos de fontes"]
    assert report["sources"][0]["Servidor"] == "srv-bi"
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
    new["tables"][0]["measures"][0]["expression"] = "SUM('Fato Vendas'[Receita]) * 1.1"
    new["tables"][0]["columns"][4]["formatString"] = "R$ #,0"
    new["relationships"][0]["crossFilteringBehavior"] = "BothDirections"

    result = compare_models(base, new)

    assert result["dashboard_novo"] == "Demo Comercial v2"
    assert result["medidas"]["modificadas"][0]["medida"] == "Receita Total"
    assert result["colunas"]["modificadas"][0]["coluna"] == "Receita"
    assert result["relacionamentos"]["modificados"][0]["relacionamento"] == (
        "Fato Vendas.Id Produto -> Dim Produto.Id Produto"
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
