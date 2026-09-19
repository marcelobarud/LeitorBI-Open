"""Adapter do export JSON para o contrato canônico."""

from typing import Any, Mapping

from app.ingestion.normalization import normalize_model


def read_json_model(data: Mapping[str, Any]) -> dict[str, Any]:
    return normalize_model(data, source_format="json")
