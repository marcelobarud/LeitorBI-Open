from typing import Any

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.demo_data import DEMO_MODEL
from app.diagnostics.events import record_event
from app.observability import log_http_request
from app.schemas import CompareResponse, ReportResponse
from app.rate_limit import rate_limiter
from app.security import assert_safe_origin, cors_origins, docs_enabled, is_production, validate_security_config
from app.services.analyzer import PowerBIAnalyzer
from app.services.compare import compare_models
from app.services.excel_export import build_excel
from app.ingestion.loader import read_model_upload
from app.upload_validation import validate_model_export

app = FastAPI(
    title="LeitorBI-Web Open API",
    version="0.1.0",
    docs_url="/docs" if docs_enabled() else None,
    redoc_url="/redoc" if docs_enabled() else None,
    openapi_url="/openapi.json" if docs_enabled() else None,
)


@app.on_event("startup")
def startup() -> None:
    validate_security_config()


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
    expose_headers=["Retry-After", "X-Request-ID"],
    allow_credentials=False,
    max_age=600,
)


@app.middleware("http")
async def reject_unsafe_cross_origin_requests(request: Request, call_next):
    assert_safe_origin(request)

    async def rate_limited_call(next_request: Request):
        allowed, retry_after = rate_limiter.check(next_request)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Limite de requisições atingido. Tente novamente em instantes."},
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(next_request)

    response = await log_http_request(request, rate_limited_call)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if is_production():
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/models/analyze", response_model=ReportResponse)
async def analyze_model(
    file: UploadFile = File(...),
) -> ReportResponse:
    record_event("analysis_started")
    data = await read_model_upload(file)
    report = ReportResponse.model_validate(PowerBIAnalyzer(data).full_report())
    record_event("analysis_completed", tables=len(report.tables), measures=len(report.measures))
    return report


@app.post("/api/models/compare", response_model=CompareResponse)
async def compare_model_exports(
    base: UploadFile = File(...),
    novo: UploadFile = File(...),
) -> CompareResponse:
    record_event("comparison_started")
    base_data = await read_model_upload(base)
    new_data = await read_model_upload(novo)
    result = CompareResponse.model_validate(compare_models(base_data, new_data))
    record_event("comparison_completed")
    return result


@app.post("/api/models/export-excel")
async def export_excel(
    file: UploadFile = File(...),
) -> StreamingResponse:
    record_event("excel_export_started")
    data = await read_model_upload(file)
    report = PowerBIAnalyzer(data).full_report()
    record_event("excel_export_completed", tables=len(report.get("tables", [])), measures=len(report.get("measures", [])))
    return excel_response(report)


@app.get("/api/public/demo/analyze", response_model=ReportResponse)
def analyze_public_demo_model() -> ReportResponse:
    return ReportResponse.model_validate(PowerBIAnalyzer(validate_model_export(DEMO_MODEL)).full_report())


def excel_response(report: dict[str, Any]) -> StreamingResponse:
    output = build_excel(report)
    filename = f"{report['raw'].get('dashboardName') or 'leitorbi'}_analise.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
