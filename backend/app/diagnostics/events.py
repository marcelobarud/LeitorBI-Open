import logging
from typing import Any

from app.diagnostics.context import current_request_id


logger = logging.getLogger("leitorbi.pipeline")


def record_event(event: str, **fields: Any) -> None:
    extra = {"request_id": current_request_id() or "unknown", "event": event, **fields}
    logger.info(event, extra=extra)
