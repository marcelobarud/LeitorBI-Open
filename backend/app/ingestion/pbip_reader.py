import io
import posixpath
import re
import stat
from pathlib import PurePosixPath
from typing import Any, BinaryIO
from zipfile import BadZipFile, ZipFile, ZipInfo

from fastapi import HTTPException

from app.diagnostics.events import record_event
from app.ingestion.tmdl_reader import read_tmdl_model
from app.ingestion.tmsl_reader import read_tmsl_model


MAX_PBIP_FILES = 5000
MAX_PBIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_PBIP_PATH_DEPTH = 20
MAX_TMSL_BYTES = 100 * 1024 * 1024
NESTED_ARCHIVE_SUFFIXES = {".7z", ".gz", ".rar", ".tar", ".tgz", ".zip"}
SEMANTIC_MODEL_SUFFIX = ".semanticmodel"


def _normalized_name(name: str) -> str:
    return name.replace("\\", "/")


def _validate_member(info: ZipInfo) -> str:
    name = _normalized_name(info.filename)
    if not name or "\x00" in name:
        raise HTTPException(status_code=422, detail="ZIP PBIP inseguro: nome de arquivo inválido.")
    if name.startswith("/") or re.match(r"^[A-Za-z]:/", name):
        raise HTTPException(status_code=422, detail="ZIP PBIP inseguro: caminho absoluto não permitido.")

    parts = PurePosixPath(name).parts
    if ".." in parts:
        raise HTTPException(status_code=422, detail="ZIP PBIP inseguro: caminho com '..' não permitido.")
    if len(parts) > MAX_PBIP_PATH_DEPTH:
        raise HTTPException(status_code=422, detail="ZIP PBIP inseguro: profundidade de caminho excedida.")
    if stat.S_ISLNK((info.external_attr >> 16) & 0o170000):
        raise HTTPException(status_code=422, detail="ZIP PBIP inseguro: links simbólicos não são permitidos.")
    if not info.is_dir() and PurePosixPath(name).suffix.lower() in NESTED_ARCHIVE_SUFFIXES:
        raise HTTPException(status_code=422, detail="ZIP PBIP inseguro: arquivos compactados aninhados não são permitidos.")
    return posixpath.normpath(name)


def _archive_entries(archive: ZipFile) -> dict[str, ZipInfo]:
    infos = archive.infolist()
    if len(infos) > MAX_PBIP_FILES:
        raise HTTPException(status_code=422, detail="ZIP PBIP inválido: quantidade de arquivos excede o limite permitido.")

    entries: dict[str, ZipInfo] = {}
    total_size = 0
    for info in infos:
        name = _validate_member(info)
        if name in entries:
            raise HTTPException(status_code=422, detail="ZIP PBIP inválido: arquivos duplicados não são permitidos.")
        entries[name] = info
        total_size += max(0, info.file_size)
        if total_size > MAX_PBIP_UNCOMPRESSED_BYTES:
            raise HTTPException(status_code=422, detail="ZIP PBIP inválido: tamanho descompactado excede o limite permitido.")
    return entries


def _semantic_model_parent(path: str) -> str | None:
    parent = posixpath.dirname(path)
    if posixpath.basename(parent).lower().endswith(SEMANTIC_MODEL_SUFFIX):
        return parent
    if not parent:
        return ""
    return None


def _project_name(entries: dict[str, ZipInfo], fallback: str) -> str:
    pbip_names = [path for path in entries if path.lower().endswith(".pbip")]
    if pbip_names:
        return posixpath.splitext(posixpath.basename(pbip_names[0]))[0]
    return fallback


def _model_candidates(entries: dict[str, ZipInfo]) -> list[tuple[str, str]]:
    candidates = []
    for path in entries:
        if posixpath.basename(path).lower() != "model.bim":
            continue
        parent = _semantic_model_parent(path)
        if parent is not None:
            candidates.append((path, parent))
    return candidates


def _has_definition_pbism(entries: dict[str, ZipInfo], semantic_parent: str) -> bool:
    definition_path = f"{semantic_parent}/definition.pbism" if semantic_parent else "definition.pbism"
    return definition_path in entries


def _tmdl_definition_roots(entries: dict[str, ZipInfo]) -> list[str]:
    roots: set[str] = set()
    for path in entries:
        parts = path.split("/")
        for index, part in enumerate(parts):
            if part.casefold() != "definition":
                continue
            semantic_parent = "/".join(parts[:index])
            if not semantic_parent or posixpath.basename(semantic_parent).casefold().endswith(SEMANTIC_MODEL_SUFFIX):
                roots.add("/".join(parts[: index + 1]))
    return sorted(roots)


def _read_member(archive: ZipFile, info: ZipInfo) -> bytes:
    if info.file_size > MAX_TMSL_BYTES:
        raise HTTPException(status_code=422, detail="Arquivo de definição excede o limite de leitura permitido.")
    try:
        return archive.read(info)
    except (BadZipFile, RuntimeError, OSError) as exc:
        raise HTTPException(status_code=422, detail="ZIP PBIP corrompido ou protegido contra leitura.") from exc


def _archive_source(content: bytes | BinaryIO) -> BinaryIO:
    if isinstance(content, (bytes, bytearray)):
        return io.BytesIO(content)
    content.seek(0)
    return content


def read_pbip_archive(content: bytes | BinaryIO, filename: str = "modelo.zip") -> dict[str, Any]:
    try:
        with ZipFile(_archive_source(content)) as archive:
            entries = _archive_entries(archive)
            record_event(
                "archive_validated",
                input_type="pbip_zip",
                files=len(entries),
                uncompressed_bytes=sum(max(0, info.file_size) for info in entries.values()),
            )
            candidates = _model_candidates(entries)
            tmdl_roots = _tmdl_definition_roots(entries)

            if len(candidates) > 1 or len(tmdl_roots) > 1:
                raise HTTPException(status_code=422, detail="Projeto PBIP ambíguo: mais de um modelo semântico foi encontrado.")
            if candidates and tmdl_roots:
                raise HTTPException(status_code=422, detail="Projeto PBIP ambíguo: estruturas TMSL e TMDL foram encontradas juntas.")
            if not candidates and not tmdl_roots:
                if any(path.lower().endswith(".report/definition.pbir") for path in entries):
                    raise HTTPException(
                        status_code=422,
                        detail="Este projeto PBIP não contém um modelo semântico local para análise.",
                    )
                raise HTTPException(status_code=422, detail="Não foi encontrada uma pasta SemanticModel com model.bim no ZIP PBIP.")

            safe_filename = posixpath.basename(_normalized_name(filename))
            project_name = _project_name(entries, posixpath.splitext(safe_filename)[0])
            if candidates:
                model_path, semantic_parent = candidates[0]
                record_event(
                    "semantic_model_found",
                    format="tmsl",
                    model_file=model_path.rsplit("/", 1)[-1],
                    definition_pbism=_has_definition_pbism(entries, semantic_parent),
                )
                semantic_name = posixpath.basename(semantic_parent) if semantic_parent else project_name
                if semantic_name.lower().endswith(SEMANTIC_MODEL_SUFFIX):
                    semantic_name = semantic_name[: -len(SEMANTIC_MODEL_SUFFIX)]
                return read_tmsl_model(_read_member(archive, entries[model_path]), project_name, semantic_name)

            definition_root = tmdl_roots[0]
            tmdl_files = {
                path: _read_member(archive, info)
                for path, info in entries.items()
                if path.casefold().startswith(f"{definition_root.casefold()}/")
                and path.casefold().endswith(".tmdl")
            }
            if not tmdl_files:
                raise HTTPException(status_code=422, detail="A definição TMDL está vazia ou incompleta.")
            semantic_parent = posixpath.dirname(definition_root)
            semantic_name = posixpath.basename(semantic_parent) if semantic_parent else project_name
            if semantic_name.casefold().endswith(SEMANTIC_MODEL_SUFFIX):
                semantic_name = semantic_name[: -len(SEMANTIC_MODEL_SUFFIX)]
            record_event(
                "semantic_model_found",
                format="tmdl",
                definition_root=definition_root,
                tmdl_files=len(tmdl_files),
                definition_pbism=_has_definition_pbism(entries, semantic_parent),
            )
            return read_tmdl_model(tmdl_files, project_name, semantic_name)
    except (BadZipFile, OSError) as exc:
        raise HTTPException(status_code=422, detail="Arquivo ZIP inválido ou corrompido.") from exc
