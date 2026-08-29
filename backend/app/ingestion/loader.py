from typing import Any

from fastapi import HTTPException, UploadFile

from app.diagnostics.events import record_event
from app.upload_validation import read_json_upload, read_pbip_upload


async def read_model_upload(file: UploadFile) -> dict[str, Any]:
    filename = (file.filename or "").lower()
    record_event("upload_received", input_type="json" if filename.endswith(".json") else "pbip_zip" if filename.endswith(".zip") else "unsupported")
    if filename.endswith(".json"):
        return await read_json_upload(file)
    if filename.endswith(".zip"):
        return await read_pbip_upload(file)
    raise HTTPException(status_code=400, detail="Envie um JSON do LeitorBI ou um ZIP de projeto PBIP.")
