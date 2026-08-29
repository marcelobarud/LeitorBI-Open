import json
import os
import tempfile
from typing import Any

from fastapi import HTTPException, UploadFile

from app.ingestion.pbip_reader import read_pbip_archive


DEFAULT_MAX_UPLOAD_MB = 10
DEFAULT_MAX_PBIP_UPLOAD_MB = 100
UPLOAD_READ_CHUNK_BYTES = 64 * 1024


def max_upload_bytes() -> int:
    raw_value = os.getenv("LEITORBI_MAX_UPLOAD_MB", str(DEFAULT_MAX_UPLOAD_MB))
    try:
        megabytes = int(raw_value)
    except ValueError:
        megabytes = DEFAULT_MAX_UPLOAD_MB
    return max(1, megabytes) * 1024 * 1024


def max_pbip_upload_bytes() -> int:
    raw_value = os.getenv("LEITORBI_MAX_PBIP_UPLOAD_MB", str(DEFAULT_MAX_PBIP_UPLOAD_MB))
    try:
        megabytes = int(raw_value)
    except ValueError:
        megabytes = DEFAULT_MAX_PBIP_UPLOAD_MB
    return max(1, megabytes) * 1024 * 1024


def validate_model_export(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=422,
            detail="Exportação incompatível: o JSON precisa ter um objeto na raiz.",
        )

    tables = data.get("tables")
    if not isinstance(tables, list):
        raise HTTPException(
            status_code=422,
            detail="Exportação incompatível: campo obrigatório 'tables' ausente ou inválido.",
        )

    relationships = data.get("relationships", [])
    if relationships is not None and not isinstance(relationships, list):
        raise HTTPException(
            status_code=422,
            detail="Exportação incompatível: campo 'relationships' precisa ser uma lista.",
        )

    metadata = data.get("modelMetadata", {})
    if metadata is not None and not isinstance(metadata, dict):
        raise HTTPException(
            status_code=422,
            detail="Exportação incompatível: campo 'modelMetadata' precisa ser um objeto.",
        )

    invalid_tables = [
        index + 1
        for index, table in enumerate(tables)
        if not isinstance(table, dict) or not isinstance(table.get("name", ""), str) or not table.get("name", "").strip()
    ]
    if invalid_tables:
        raise HTTPException(
            status_code=422,
            detail=f"Exportação incompatível: tabela inválida na posição {invalid_tables[0]}.",
        )

    return data


async def read_upload_content(file: UploadFile, limit: int) -> bytes:
    content = bytearray()
    while True:
        chunk = await file.read(min(UPLOAD_READ_CHUNK_BYTES, limit + 1 - len(content)))
        if not chunk:
            return bytes(content)
        content.extend(chunk)
        if len(content) > limit:
            max_mb = limit // (1024 * 1024)
            raise HTTPException(status_code=413, detail=f"Arquivo muito grande. O limite atual é {max_mb} MB.")


async def read_upload_spooled(file: UploadFile, limit: int) -> tempfile.SpooledTemporaryFile[bytes]:
    """Recebe o upload em chunks, mantendo somente um buffer pequeno em RAM."""
    temporary = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b")
    total = 0
    try:
        while True:
            chunk = await file.read(min(UPLOAD_READ_CHUNK_BYTES, limit + 1 - total))
            if not chunk:
                temporary.seek(0)
                return temporary
            total += len(chunk)
            if total > limit:
                max_mb = limit // (1024 * 1024)
                raise HTTPException(status_code=413, detail=f"Arquivo muito grande. O limite atual é {max_mb} MB.")
            temporary.write(chunk)
    except Exception:
        temporary.close()
        raise


async def read_json_upload(file: UploadFile) -> dict[str, Any]:
    filename = file.filename or ""
    if not filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Envie um arquivo JSON exportado pelo LeitorBI.")

    limit = max_upload_bytes()
    content = await read_upload_content(file, limit)
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio. Envie um JSON exportado pelo LeitorBI.")

    try:
        data = json.loads(content.decode("utf-8-sig"))
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="JSON inválido: use um arquivo em UTF-8.") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"JSON inválido: verifique a sintaxe na linha {exc.lineno}, coluna {exc.colno}.",
        ) from exc

    return validate_model_export(data)


async def read_pbip_upload(file: UploadFile) -> dict[str, Any]:
    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Envie um arquivo ZIP de projeto PBIP.")

    upload = await read_upload_spooled(file, max_pbip_upload_bytes())
    try:
        upload.seek(0, 2)
        empty = upload.tell() == 0
        upload.seek(0)
        if empty:
            raise HTTPException(status_code=400, detail="Arquivo vazio. Envie um ZIP de projeto PBIP.")
        return validate_model_export(read_pbip_archive(upload, filename))
    finally:
        upload.close()
