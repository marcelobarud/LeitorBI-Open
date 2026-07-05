import json
import os
from typing import Any

from fastapi import HTTPException, UploadFile


DEFAULT_MAX_UPLOAD_MB = 10


def max_upload_bytes() -> int:
    raw_value = os.getenv("LEITORBI_MAX_UPLOAD_MB", str(DEFAULT_MAX_UPLOAD_MB))
    try:
        megabytes = int(raw_value)
    except ValueError:
        megabytes = DEFAULT_MAX_UPLOAD_MB
    return max(1, megabytes) * 1024 * 1024


def validate_model_export(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=422,
            detail="Export incompatível: o JSON precisa ter um objeto na raiz.",
        )

    tables = data.get("tables")
    if not isinstance(tables, list):
        raise HTTPException(
            status_code=422,
            detail="Export incompatível: campo obrigatório 'tables' ausente ou inválido.",
        )

    relationships = data.get("relationships", [])
    if relationships is not None and not isinstance(relationships, list):
        raise HTTPException(
            status_code=422,
            detail="Export incompatível: campo 'relationships' precisa ser uma lista.",
        )

    metadata = data.get("modelMetadata", {})
    if metadata is not None and not isinstance(metadata, dict):
        raise HTTPException(
            status_code=422,
            detail="Export incompatível: campo 'modelMetadata' precisa ser um objeto.",
        )

    invalid_tables = [
        index + 1
        for index, table in enumerate(tables)
        if not isinstance(table, dict) or not isinstance(table.get("name", ""), str)
    ]
    if invalid_tables:
        raise HTTPException(
            status_code=422,
            detail=f"Export incompatível: tabela inválida na posição {invalid_tables[0]}.",
        )

    return data


async def read_json_upload(file: UploadFile) -> dict[str, Any]:
    filename = file.filename or ""
    if not filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Envie um arquivo JSON exportado pelo LeitorBI.")

    content = await file.read()
    limit = max_upload_bytes()
    if len(content) > limit:
        max_mb = limit // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Arquivo muito grande. O limite atual é {max_mb} MB.")

    try:
        data = json.loads(content.decode("utf-8-sig"))
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="JSON inválido: use um arquivo em UTF-8.") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"JSON inválido: {exc}") from exc

    return validate_model_export(data)
