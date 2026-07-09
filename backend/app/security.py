import os
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, status


DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def cors_origins() -> list[str]:
    configured = os.getenv("LEITORBI_CORS_ORIGINS")
    if not configured:
        return DEFAULT_CORS_ORIGINS

    origins = [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]
    if "*" in origins:
        raise RuntimeError("LEITORBI_CORS_ORIGINS nao pode usar '*' quando cookies de sessao estao habilitados.")
    return origins


def origin_from_url(value: str) -> str:
    parsed = urlsplit(value)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def allowed_request_origins() -> set[str]:
    return set(cors_origins())


def assert_safe_origin(request: Request) -> None:
    if request.method.upper() not in UNSAFE_METHODS:
        return

    allowed_origins = allowed_request_origins()
    origin = request.headers.get("origin")
    if origin:
        if origin.rstrip("/") not in allowed_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Origem da requisicao nao autorizada.",
            )
        return

    referer = request.headers.get("referer")
    if referer:
        referer_origin = origin_from_url(referer)
        if referer_origin not in allowed_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Origem da requisicao nao autorizada.",
            )
