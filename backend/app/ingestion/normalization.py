"""Normalização compartilhada do modelo semântico.

Os readers interpretam a sintaxe de cada formato e entregam um dicionário
estrutural. Este módulo é a única fonte de verdade para aliases, tipos
canônicos, chaves de comparação e expressões comparáveis.
"""

from __future__ import annotations

import re
import textwrap
from collections import Counter
from typing import Any, Mapping


NORMALIZATION_KEY = "__normalization"
UNKNOWN = "Unknown"


def _text(value: Any) -> str:
    return "" if value is None else str(value)


def _lookup_key(value: Any) -> str:
    return re.sub(r"[\s_\-]+", "", _text(value).strip().casefold())


def _unquote_text(value: Any) -> str:
    text = _text(value).strip()
    if len(text) >= 2 and text[0] == text[-1] == "\"":
        return text[1:-1].replace('""', '"').replace('\\"', '"')
    if len(text) >= 2 and text[0] == text[-1] == "'":
        return text[1:-1].replace("''", "'")
    return text


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    normalized = _lookup_key(value)
    if normalized in {"true", "1", "yes", "y", "sim", "s"}:
        return True
    if normalized in {"false", "0", "no", "n", "nao"}:
        return False
    return default


def _field(source: Mapping[str, Any], key: str, default: Any = "") -> tuple[Any, str]:
    if key not in source or source.get(key) is None:
        return default, "default" if default != "" else "unknown"
    return source.get(key), "explicit"


def _optional_bool(source: Mapping[str, Any], key: str, default: bool | None) -> tuple[bool | None, str]:
    if key not in source or source.get(key) is None:
        return default, "default" if default is not None else "unknown"
    return _coerce_bool(source.get(key)), "explicit"


def _text_field(source: Mapping[str, Any], key: str) -> tuple[str, str]:
    value, source_kind = _field(source, key, "")
    return _unquote_text(value), source_kind


def _mapping_items(source: Mapping[str, Any], key: str) -> list[Mapping[str, Any]]:
    value = source.get(key, [])
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, Mapping)]


def _enum(value: Any, aliases: Mapping[str, str], default: str = "") -> tuple[str, str]:
    text = _text(value).strip()
    if not text:
        return default, "unknown" if not default else "default"
    return aliases.get(_lookup_key(text), text), "explicit"


DATA_TYPE_ALIASES = {
    "string": "String",
    "text": "String",
    "str": "String",
    "int64": "Int64",
    "integer": "Int64",
    "int": "Int64",
    "double": "Double",
    "decimal": "Decimal",
    "currency": "Currency",
    "datetime": "DateTime",
    "date": "DateTime",
    "time": "Time",
    "boolean": "Boolean",
    "bool": "Boolean",
    "binary": "Binary",
    "variant": "Variant",
}

TABLE_TYPE_ALIASES = {
    "regular": "Regular",
    "calculated": "CalculatedTable",
    "calculatedtable": "CalculatedTable",
}

COLUMN_TYPE_ALIASES = {
    "datacolumn": "DataColumn",
    "calculated": "CalculatedColumn",
    "calculatedcolumn": "CalculatedColumn",
}

MODE_ALIASES = {
    "import": "Import",
    "directquery": "DirectQuery",
    "dual": "Dual",
    "directlake": "DirectLake",
}

PARTITION_SOURCE_ALIASES = {
    "m": "M",
    "powerquery": "M",
    "calculated": "Calculated",
    "calculatedtable": "Calculated",
    "entity": "Entity",
    "policyrange": "PolicyRange",
}

CARDINALITY_ALIASES = {
    "many": "Many",
    "one": "One",
    "none": "None",
}

FILTER_ALIASES = {
    "onedirection": "OneDirection",
    "bothdirections": "BothDirections",
    "automatic": "Automatic",
}

SUMMARIZE_BY_ALIASES = {
    "none": "None",
    "default": "Default",
    "sum": "Sum",
    "min": "Min",
    "max": "Max",
    "average": "Average",
    "count": "Count",
    "countnonnull": "CountNonNull",
}


def normalize_data_type(value: Any) -> str:
    return _enum(value, DATA_TYPE_ALIASES)[0]


def normalize_table_type(value: Any, default: str = "Regular") -> str:
    return _enum(value, TABLE_TYPE_ALIASES, default)[0]


def normalize_column_type(value: Any, default: str = "DataColumn") -> str:
    return _enum(value, COLUMN_TYPE_ALIASES, default)[0]


def normalize_mode(value: Any, default: str = "") -> str:
    return _enum(value, MODE_ALIASES, default)[0]


def normalize_partition_source_type(value: Any, default: str = "") -> str:
    return _enum(value, PARTITION_SOURCE_ALIASES, default)[0]


def normalize_cardinality(value: Any, default: str = "") -> str:
    return _enum(value, CARDINALITY_ALIASES, default)[0]


def normalize_filter_behavior(value: Any, default: str = "") -> str:
    return _enum(value, FILTER_ALIASES, default)[0]


def normalize_summarize_by(value: Any, default: str = "") -> str:
    return _enum(value, SUMMARIZE_BY_ALIASES, default)[0]


def normalize_expression(value: Any) -> str:
    """Remove only serialization differences from a DAX/M expression."""
    text = _text(value).replace("\r\n", "\n").replace("\r", "\n")
    return textwrap.dedent(text).strip()


def canonical_identifier(value: Any) -> str:
    return _unquote_text(value).strip().casefold()


def relationship_endpoint_key(relationship: Mapping[str, Any]) -> str:
    parts = (
        relationship.get("fromTable", ""),
        relationship.get("fromColumn", ""),
        relationship.get("toTable", ""),
        relationship.get("toColumn", ""),
    )
    return "|".join(canonical_identifier(part) for part in parts)


def _entity_meta(source_format: str, field_sources: Mapping[str, str], normalized: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "sourceFormat": source_format,
        "fields": dict(field_sources),
        "normalized": dict(normalized),
    }


def _normalize_partition(partition: Mapping[str, Any], source_format: str) -> dict[str, Any]:
    name, name_source = _text_field(partition, "name")
    raw_source_type, source_type_source = _field(partition, "sourceType", "")
    raw_mode, mode_source = _field(partition, "mode", "")
    expression, expression_source = _text_field(partition, "expression")
    source_type = normalize_partition_source_type(raw_source_type)
    mode = normalize_mode(raw_mode)
    result = {
        "name": name,
        "sourceType": source_type,
        "mode": mode,
        "expression": expression,
        "normalizedExpression": normalize_expression(expression),
        NORMALIZATION_KEY: _entity_meta(
            source_format,
            {
                "name": name_source,
                "sourceType": source_type_source,
                "mode": mode_source,
                "expression": expression_source,
            },
            {"sourceType": source_type, "mode": mode, "expression": normalize_expression(expression)},
        ),
    }
    return result


def _normalize_column(column: Mapping[str, Any], source_format: str) -> dict[str, Any]:
    name, name_source = _text_field(column, "name")
    raw_data_type, data_type_source = _field(column, "dataType", "")
    raw_column_type, column_type_source = _field(column, "columnType", "DataColumn")
    description, description_source = _text_field(column, "description")
    format_string, format_source = _text_field(column, "formatString")
    display_folder, folder_source = _text_field(column, "displayFolder")
    data_category, category_source = _text_field(column, "dataCategory")
    summarize_by, summarize_source = _field(column, "summarizeBy", "")
    sort_by_column, sort_source = _text_field(column, "sortByColumn")
    is_hidden, hidden_source = _optional_bool(column, "isHidden", False)
    result = {
        "name": name,
        "dataType": normalize_data_type(raw_data_type),
        "columnType": normalize_column_type(raw_column_type),
        "isHidden": is_hidden,
        "formatString": format_string,
        "dataCategory": data_category,
        "displayFolder": display_folder,
        "description": description,
        "summarizeBy": normalize_summarize_by(summarize_by),
        "sortByColumn": sort_by_column,
        NORMALIZATION_KEY: _entity_meta(
            source_format,
            {
                "name": name_source,
                "dataType": data_type_source,
                "columnType": column_type_source,
                "isHidden": hidden_source,
                "formatString": format_source,
                "dataCategory": category_source,
                "displayFolder": folder_source,
                "description": description_source,
                "summarizeBy": summarize_source,
                "sortByColumn": sort_source,
            },
            {
                "dataType": normalize_data_type(raw_data_type),
                "columnType": normalize_column_type(raw_column_type),
                "isHidden": is_hidden,
                "formatString": format_string,
                "displayFolder": display_folder,
                "description": description,
                "summarizeBy": normalize_summarize_by(summarize_by),
                "sortByColumn": sort_by_column,
            },
        ),
    }
    return result


def _normalize_measure(measure: Mapping[str, Any], source_format: str) -> dict[str, Any]:
    name, name_source = _text_field(measure, "name")
    expression, expression_source = _text_field(measure, "expression")
    description, description_source = _text_field(measure, "description")
    format_string, format_source = _text_field(measure, "formatString")
    display_folder, folder_source = _text_field(measure, "displayFolder")
    data_type, data_type_source = _field(measure, "dataType", "")
    is_hidden, hidden_source = _optional_bool(measure, "isHidden", False)
    normalized_expression = normalize_expression(expression)
    result = {
        "name": name,
        "expression": expression,
        "normalizedExpression": normalized_expression,
        "isHidden": is_hidden,
        "formatString": format_string,
        "displayFolder": display_folder,
        "description": description,
        "dataType": normalize_data_type(data_type),
        NORMALIZATION_KEY: _entity_meta(
            source_format,
            {
                "name": name_source,
                "expression": expression_source,
                "isHidden": hidden_source,
                "formatString": format_source,
                "displayFolder": folder_source,
                "description": description_source,
                "dataType": data_type_source,
            },
            {"expression": normalized_expression},
        ),
    }
    return result


def _normalize_table(table: Mapping[str, Any], source_format: str) -> dict[str, Any]:
    source_partitions = _mapping_items(table, "partitions")
    partitions = [_normalize_partition(item, source_format) for item in source_partitions]
    source_columns = _mapping_items(table, "columns")
    source_measures = _mapping_items(table, "measures")
    name, name_source = _text_field(table, "name")
    raw_table_type, table_type_source = _field(table, "tableType", "")
    inferred_table_type = any(partition["sourceType"] == "Calculated" for partition in partitions)
    if _text(raw_table_type).strip():
        table_type = normalize_table_type(raw_table_type)
    elif inferred_table_type:
        table_type = "CalculatedTable"
        table_type_source = "inferred"
    else:
        table_type = "Regular"
        table_type_source = "default"
    description, description_source = _text_field(table, "description")
    data_category, category_source = _text_field(table, "dataCategory")
    is_hidden, hidden_source = _optional_bool(table, "isHidden", False)
    is_auto_generated, generated_source = _optional_bool(table, "isAutoGenerated", False)
    columns = [_normalize_column(item, source_format) for item in source_columns]
    measures = [_normalize_measure(item, source_format) for item in source_measures]
    result = {
        "name": name,
        "tableType": table_type,
        "isHidden": is_hidden,
        "isAutoGenerated": is_auto_generated,
        "description": description,
        "dataCategory": data_category,
        "columns": columns,
        "measures": measures,
        "partitions": partitions,
        NORMALIZATION_KEY: _entity_meta(
            source_format,
            {
                "name": name_source,
                "tableType": table_type_source,
                "isHidden": hidden_source,
                "isAutoGenerated": generated_source,
                "description": description_source,
                "dataCategory": category_source,
            },
            {"tableType": table_type, "isHidden": is_hidden, "isAutoGenerated": is_auto_generated},
        ),
    }
    return result


def _normalize_relationship(relationship: Mapping[str, Any], source_format: str) -> dict[str, Any]:
    name, name_source = _text_field(relationship, "name")
    from_table, from_table_source = _text_field(relationship, "fromTable")
    from_column, from_column_source = _text_field(relationship, "fromColumn")
    to_table, to_table_source = _text_field(relationship, "toTable")
    to_column, to_column_source = _text_field(relationship, "toColumn")
    raw_from_cardinality, from_cardinality_source = _field(relationship, "fromCardinality", "")
    raw_to_cardinality, to_cardinality_source = _field(relationship, "toCardinality", "")
    raw_filter, filter_source = _field(relationship, "crossFilteringBehavior", "")
    raw_security_filter, security_source = _field(relationship, "securityFilteringBehavior", "")
    from_cardinality = normalize_cardinality(raw_from_cardinality)
    to_cardinality = normalize_cardinality(raw_to_cardinality)
    cross_filter = normalize_filter_behavior(raw_filter)
    security_filter = normalize_filter_behavior(raw_security_filter)
    is_active, active_source = _optional_bool(relationship, "isActive", None)
    result = {
        "name": name,
        "fromTable": from_table,
        "fromColumn": from_column,
        "toTable": to_table,
        "toColumn": to_column,
        "fromCardinality": from_cardinality,
        "toCardinality": to_cardinality,
        "crossFilteringBehavior": cross_filter,
        "securityFilteringBehavior": security_filter,
        "isActive": is_active,
        NORMALIZATION_KEY: _entity_meta(
            source_format,
            {
                "name": name_source,
                "fromTable": from_table_source,
                "fromColumn": from_column_source,
                "toTable": to_table_source,
                "toColumn": to_column_source,
                "fromCardinality": from_cardinality_source,
                "toCardinality": to_cardinality_source,
                "crossFilteringBehavior": filter_source,
                "securityFilteringBehavior": security_source,
                "isActive": active_source,
            },
            {
                "fromCardinality": from_cardinality or UNKNOWN,
                "toCardinality": to_cardinality or UNKNOWN,
                "crossFilteringBehavior": cross_filter or UNKNOWN,
                "securityFilteringBehavior": security_filter or UNKNOWN,
                "isActive": UNKNOWN if is_active is None else is_active,
            },
        ),
    }
    return result


def _assign_relationship_keys(relationships: list[dict[str, Any]]) -> None:
    endpoint_counts = Counter(relationship_endpoint_key(item) for item in relationships)
    used: Counter[str] = Counter()
    name_counts = Counter(
        f"{relationship_endpoint_key(item)}|name:{canonical_identifier(item.get('name', ''))}"
        for item in relationships
    )
    for relationship in relationships:
        endpoint_key = relationship_endpoint_key(relationship)
        used[endpoint_key] += 1
        key = endpoint_key
        if endpoint_counts[endpoint_key] > 1:
            name_key = canonical_identifier(relationship.get("name", ""))
            key = f"{endpoint_key}|name:{name_key or used[endpoint_key]}"
            if name_counts[key] > 1:
                key = f"{key}|ordinal:{used[endpoint_key]}"
        relationship[NORMALIZATION_KEY]["relationshipKey"] = key


def normalize_model(data: Mapping[str, Any], source_format: str = "json") -> dict[str, Any]:
    """Produce the canonical model consumed by ``PowerBIAnalyzer``."""
    source_tables = data.get("tables", []) if isinstance(data, Mapping) else []
    if not isinstance(source_tables, list):
        source_tables = []
    tables = [
        _normalize_table(table, source_format)
        for table in source_tables
        if isinstance(table, Mapping)
    ]
    source_relationships = data.get("relationships", []) if isinstance(data, Mapping) else []
    if not isinstance(source_relationships, list):
        source_relationships = []
    relationships = [
        _normalize_relationship(relationship, source_format)
        for relationship in source_relationships
        if isinstance(relationship, Mapping)
    ]
    _assign_relationship_keys(relationships)

    metadata_source = data.get("modelMetadata", {}) if isinstance(data, Mapping) else {}
    metadata_source = metadata_source if isinstance(metadata_source, Mapping) else {}
    raw_culture, culture_source = _field(metadata_source, "culture", "")
    raw_mode, mode_source = _field(metadata_source, "defaultMode", "")
    if not _text(raw_mode).strip():
        raw_mode, mode_source = _field(metadata_source, "storageMode", "")
    normalized_modes = {
        partition["mode"]
        for table in tables
        for partition in table["partitions"]
        if partition["mode"]
    }
    default_mode = normalize_mode(raw_mode)
    if not default_mode and len(normalized_modes) == 1:
        default_mode = next(iter(normalized_modes))
        mode_source = "inferred"

    metadata: dict[str, Any] = {
        "culture": _unquote_text(raw_culture),
        "defaultMode": default_mode,
    }
    for key in ("compatibilityLevel", "description"):
        if key in metadata_source:
            metadata[key] = metadata_source[key]

    return {
        "dashboardName": _text(data.get("dashboardName", "")),
        "modelName": _text(data.get("modelName", "")),
        "exportDate": _text(data.get("exportDate", "")),
        "modelMetadata": metadata,
        "tables": tables,
        "relationships": relationships,
        NORMALIZATION_KEY: {
            "sourceFormat": source_format,
            "fields": {"culture": culture_source, "defaultMode": mode_source},
        },
    }
