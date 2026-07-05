import os
from typing import Any

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.demo_data import DEMO_MODEL
from app.schemas import CompareResponse, ReportResponse
from app.services.analyzer import PowerBIAnalyzer
from app.services.compare import compare_models
from app.services.excel_export import build_excel
from app.upload_validation import read_json_upload, validate_model_export

app = FastAPI(title="LeitorBI Web API", version="0.1.0")


def cors_origins() -> list[str]:
    configured = os.getenv("LEITORBI_CORS_ORIGINS")
    if not configured:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/models/analyze", response_model=ReportResponse)
async def analyze_model(file: UploadFile = File(...)) -> ReportResponse:
    data = await read_json_upload(file)
    return ReportResponse.model_validate(PowerBIAnalyzer(data).full_report())


@app.post("/api/models/compare", response_model=CompareResponse)
async def compare_model_exports(base: UploadFile = File(...), novo: UploadFile = File(...)) -> CompareResponse:
    base_data = await read_json_upload(base)
    new_data = await read_json_upload(novo)
    return CompareResponse.model_validate(compare_models(base_data, new_data))


@app.post("/api/models/export-excel")
async def export_excel(file: UploadFile = File(...)) -> StreamingResponse:
    data = await read_json_upload(file)
    report = PowerBIAnalyzer(data).full_report()
    return excel_response(report)


@app.get("/api/demo/analyze", response_model=ReportResponse)
def analyze_demo_model() -> ReportResponse:
    return ReportResponse.model_validate(PowerBIAnalyzer(validate_model_export(DEMO_MODEL)).full_report())


@app.get("/api/demo/export-excel")
def export_demo_excel() -> StreamingResponse:
    report = PowerBIAnalyzer(DEMO_MODEL).full_report()
    return excel_response(report)


def excel_response(report: dict[str, Any]) -> StreamingResponse:
    output = build_excel(report)
    filename = f"{report['raw'].get('dashboardName') or 'leitorbi'}_analise.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
