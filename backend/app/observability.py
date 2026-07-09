from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response


logger = logging.getLogger("leitorbi.api")


async def log_http_request(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    started_at = time.perf_counter()
    status_code = 500

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    except Exception:
        logger.exception(
            "request_failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                "client": request.client.host if request.client else "unknown",
            },
        )
        raise
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        logger.info(
            "request_completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "client": request.client.host if request.client else "unknown",
            },
        )
        if "response" in locals():
            response.headers["X-Request-ID"] = request_id
