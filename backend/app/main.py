import json
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.demo_data import DEMO_MODEL
from app.services.analyzer import PowerBIAnalyzer
from app.services.compare import compare_models
from app.services.excel_export import build_excel

app = FastAPI(title="LeitorBI Web API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def read_json_upload(file: UploadFile) -> dict[str, Any]:
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Envie um arquivo JSON exportado pelo LeitorBI.")
    try:
        content = await file.read()
        return json.loads(content.decode("utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"JSON invalido: {exc}") from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/models/analyze")
async def analyze_model(file: UploadFile = File(...)) -> dict[str, Any]:
    data = await read_json_upload(file)
    return PowerBIAnalyzer(data).full_report()


@app.post("/api/models/compare")
async def compare_model_exports(base: UploadFile = File(...), novo: UploadFile = File(...)) -> dict[str, Any]:
    base_data = await read_json_upload(base)
    new_data = await read_json_upload(novo)
    return compare_models(base_data, new_data)


@app.post("/api/models/export-excel")
async def export_excel(file: UploadFile = File(...)) -> StreamingResponse:
    data = await read_json_upload(file)
    report = PowerBIAnalyzer(data).full_report()
    return excel_response(report)


@app.get("/api/demo/analyze")
def analyze_demo_model() -> dict[str, Any]:
    return PowerBIAnalyzer(DEMO_MODEL).full_report()


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
