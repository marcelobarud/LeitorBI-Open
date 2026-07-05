import re
from typing import Any


def safe_value(source: dict[str, Any], key: str, default: Any = "") -> Any:
    value = source.get(key, default) if isinstance(source, dict) else default
    return default if value is None else value


def safe_list(source: dict[str, Any], key: str) -> list[Any]:
    value = source.get(key, []) if isinstance(source, dict) else []
    return value if isinstance(value, list) else []


def safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def normalize_text(value: Any) -> str:
    return safe_text(value).strip().lower()


def translate_model_type(value: Any) -> str:
    mapping = {
        "calculatedtable": "Tabela calculada",
        "calculated": "Calculado",
        "regular": "Regular",
        "m": "Power Query / M",
        "import": "Importado",
        "directquery": "DirectQuery",
        "dual": "Dual",
        "calculatedcolumn": "Coluna calculada",
        "datacolumn": "Coluna de dados",
    }
    text = safe_text(value)
    return mapping.get(normalize_text(text), text)


def detect_sql_in_m_expression(expression: Any) -> str:
    text = safe_text(expression)
    patterns = [
        r"Query\s*=\s*\"([^\"]+)\"",
        r"Value\.NativeQuery\s*\([^,]+,\s*\"([^\"]+)\"",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).replace("#(lf)", "\n").replace("#(tab)", "\t")
    return ""


def detect_database_server(expression: Any) -> tuple[str, str]:
    text = safe_text(expression)
    match = re.search(r"Sql\.Database\(\s*\"([^\"]+)\"\s*,\s*\"([^\"]+)\"", text, flags=re.IGNORECASE)
    if match:
        return match.group(1), match.group(2)
    return "", ""


def detect_by_patterns(text: str, patterns: list[str]) -> bool:
    return any(pattern in text for pattern in patterns)


def display_source_type(value: Any) -> str:
    text = safe_text(value)
    normalized = normalize_text(text)
    if normalized in {"calculated", "calculatedtable", "calculated table", "calculated_table", "calculado"}:
        return "Calculada"
    return text


SOURCE_RULES = [
    {"label": "Power BI Dataset", "all": ["analysisservices.database", "powerbi://"]},
    {
        "label": "Azure SQL / Synapse",
        "all": ["sql.database"],
        "any": ["database.windows.net", ".sql.azuresynapse.net", ".sqlanalytics.net", "synapse"],
    },
    {"label": "Databricks", "any": ["databricks.catalogs", "databricks.contents"]},
    {"label": "Snowflake", "any": ["snowflake.databases"]},
    {"label": "BigQuery", "any": ["googlebigquery.database"]},
    {"label": "PostgreSQL", "any": ["postgresql.database"]},
    {"label": "MySQL", "any": ["mysql.database"]},
    {"label": "Oracle", "any": ["oracle.database"]},
    {"label": "Teradata", "any": ["teradata.database"]},
    {"label": "Azure Data Lake", "any": ["azurestorage.datalake", "azuredatalakestorage.contents"]},
    {"label": "Azure Blob Storage", "any": ["azurestorage.blobs"]},
    {"label": "SAP BW", "any": ["sapbusinesswarehouse.cubes"]},
    {"label": "SAP HANA", "any": ["saphana.database"]},
    {"label": "Fabric / OneLake", "any": ["onelake", "fabric", "lakehouse"]},
    {"label": "Salesforce", "any": ["salesforce.data", "salesforce.reports"]},
    {"label": "Dataverse", "any": ["commondataservice.database", "cds.entities", "dataverse"]},
    {"label": "Parquet", "any": ["parquet.document", ".parquet"]},
    {"label": "XML", "any": ["xml.tables", ".xml"]},
    {"label": "PDF", "any": ["pdf.tables", ".pdf"]},
    {"label": "Access", "any": ["access.database", ".accdb", ".mdb"]},
    {"label": "ODBC", "any": ["odbc.datasource", "odbc.query"]},
    {"label": "OLE DB", "any": ["oledb.datasource"]},
    {"label": "Exchange", "any": ["exchange.contents"]},
    {"label": "Google Sheets", "any": ["docs.google.com/spreadsheets", "google.com/spreadsheets"]},
    {"label": "OneDrive", "any": ["onedrive.live.com", "my.sharepoint.com/personal"]},
    {"label": "Excel", "any": ["excel.workbook", ".xlsx", ".xls"]},
    {"label": "SharePoint", "any": ["sharepoint.files", "sharepoint.contents"]},
    {"label": "Web", "any": ["web.contents"]},
    {"label": "CSV", "any": ["csv.document", ".csv"]},
    {"label": "JSON", "any": ["json.document", ".json"]},
    {"label": "OData", "any": ["odata.feed"]},
    {"label": "Analysis Services", "any": ["analysisservices.database"]},
    {"label": "Dataflow", "any": ["powerbi.dataflows"]},
    {"label": "Pasta", "any": ["folder.files", "folder.contents"]},
]


def matches_source_rule(text: str, rule: dict[str, Any]) -> bool:
    required_patterns = rule.get("all", [])
    optional_patterns = rule.get("any", [])
    has_required = all(pattern in text for pattern in required_patterns)
    has_optional = not optional_patterns or detect_by_patterns(text, optional_patterns)
    return has_required and has_optional


class PowerBIAnalyzer:
    def __init__(self, data: dict[str, Any]):
        self.data = data
        self.metadata = safe_value(data, "modelMetadata", {})
        self.tables = safe_list(data, "tables")
        self.relationships = safe_list(data, "relationships")
        self._cache: dict[str, Any] = {}

    def is_technical_date_table_name(self, table_name: Any) -> bool:
        name = normalize_text(table_name)
        return "localdatetable" in name or "datetabletemplate" in name

    def is_technical_date_table(self, table: dict[str, Any]) -> bool:
        return self.is_technical_date_table_name(safe_value(table, "name", ""))

    def tables_without_technical_dates(self) -> list[dict[str, Any]]:
        if "tables_without_dates" not in self._cache:
            self._cache["tables_without_dates"] = [
                table for table in self.tables if not self.is_technical_date_table(table)
            ]
        return self._cache["tables_without_dates"]

    def is_visible_physical_table(self, table: dict[str, Any]) -> bool:
        return not (
            self.is_technical_date_table(table)
            or safe_value(table, "isHidden", False)
            or safe_value(table, "isAutoGenerated", False)
        )

    def visible_physical_tables(self) -> list[dict[str, Any]]:
        if "visible_physical_tables" not in self._cache:
            self._cache["visible_physical_tables"] = [
                table for table in self.tables_without_technical_dates()
                if self.is_visible_physical_table(table)
            ]
        return self._cache["visible_physical_tables"]

    def count_visible_fields(self, tables: list[dict[str, Any]] | None = None) -> int:
        selected_tables = tables if tables is not None else self.tables_without_technical_dates()
        return sum(
            1
            for table in selected_tables
            for column in safe_list(table, "columns")
            if not safe_value(column, "isHidden", False)
        )

    def count_total_columns(self) -> int:
        return sum(len(safe_list(table, "columns")) for table in self.tables_without_technical_dates())

    def detect_source_type(self, expression: Any, source_type: Any) -> str:
        text = normalize_text(expression)
        source_type_norm = normalize_text(source_type)

        for rule in SOURCE_RULES:
            if matches_source_rule(text, rule):
                return safe_text(rule["label"])
        if "sql.database" in text or (source_type_norm == "m" and "select " in text):
            return "SQL"
        if source_type:
            return safe_text(source_type).upper()
        return "Não identificado"

    def count_source_types(self, only_physical_tables: bool = False) -> dict[str, int]:
        cache_key = f"source_types:{only_physical_tables}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        source_types: dict[str, int] = {}
        for table in self.tables_without_technical_dates():
            if only_physical_tables and not self.is_visible_physical_table(table):
                continue
            for partition in safe_list(table, "partitions"):
                source_type = display_source_type(self.detect_source_type(
                    safe_value(partition, "expression", ""),
                    safe_value(partition, "sourceType", ""),
                ))
                source_types[source_type] = source_types.get(source_type, 0) + 1

        self._cache[cache_key] = source_types
        return source_types

    def existing_columns_map(self) -> dict[str, dict[str, Any]]:
        if "existing_columns_map" in self._cache:
            return self._cache["existing_columns_map"]

        result: dict[str, dict[str, Any]] = {}
        for table in self.tables_without_technical_dates():
            table_name = safe_value(table, "name", "")
            table_key = normalize_text(table_name)
            result.setdefault(table_key, {"name": table_name, "columns": {}})
            for column in safe_list(table, "columns"):
                column_name = safe_value(column, "name", "")
                result[table_key]["columns"][normalize_text(column_name)] = column_name

        self._cache["existing_columns_map"] = result
        return result

    def columns_used_in_measures(self) -> set[tuple[str, str]]:
        if "columns_used_in_measures" in self._cache:
            return self._cache["columns_used_in_measures"]

        columns_map = self.existing_columns_map()
        used: set[tuple[str, str]] = set()
        patterns = [r"'([^']+)'\[([^\]]+)\]", r"\b([A-Za-z0-9_]+)\[([^\]]+)\]"]

        for measure in self.measures():
            expression = safe_text(measure.get("Expressao DAX", ""))
            for pattern in patterns:
                for table_ref, column_ref in re.findall(pattern, expression):
                    table_key = normalize_text(table_ref)
                    column_key = normalize_text(column_ref)
                    if table_key in columns_map and column_key in columns_map[table_key]["columns"]:
                        used.add((columns_map[table_key]["name"], columns_map[table_key]["columns"][column_key]))

        self._cache["columns_used_in_measures"] = used
        return used

    def summary(self) -> dict[str, Any]:
        source_types = self.count_source_types(only_physical_tables=True)
        visible_tables = self.visible_physical_tables()
        measures = self.measures()
        quality = self.quality_rows()
        return {
            "Dashboard": safe_value(self.data, "dashboardName", "Não informado"),
            "Modelo": safe_value(self.data, "modelName", "Não informado"),
            "Data de exportacao": safe_value(self.data, "exportDate", "Não informado"),
            "Cultura": safe_value(self.metadata, "culture", "Não informado"),
            "Modo padrao": safe_value(self.metadata, "defaultMode", "Não informado"),
            "Colunas utilizadas": self.count_visible_fields(visible_tables),
            "Colunas utilizadas em medidas": len(self.columns_used_in_measures()),
            "Colunas totais": self.count_total_columns(),
            "Medidas": len(measures),
            "Fontes de dados": len(source_types),
            "Tipos de fontes": ", ".join(source_types.keys()) if source_types else "Não detectado",
            "Tabelas totais": len(self.tables_without_technical_dates()),
            "Relacionamentos": len(self.relationship_rows()),
            "Pontos de atenção": len(quality),
        }

    def table_rows(self) -> list[dict[str, Any]]:
        return [
            {
                "Tabela": safe_value(table, "name", ""),
                "Tipo": translate_model_type(safe_value(table, "tableType", "")),
                "Oculta": "Sim" if safe_value(table, "isHidden", False) else "Não",
                "Colunas": len(safe_list(table, "columns")),
                "Colunas visiveis": self.count_visible_fields([table]),
                "Medidas": len(safe_list(table, "measures")),
                "Particoes": len(safe_list(table, "partitions")),
                "Descricao": safe_value(table, "description", ""),
            }
            for table in self.tables_without_technical_dates()
        ]

    def column_rows(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for table in self.tables_without_technical_dates():
            table_name = safe_value(table, "name", "")
            for column in safe_list(table, "columns"):
                rows.append({
                    "Coluna": safe_value(column, "name", ""),
                    "Tabela": table_name,
                    "Tipo de dado": safe_value(column, "dataType", ""),
                    "Tipo de coluna": translate_model_type(safe_value(column, "columnType", "")),
                    "Oculto": "Sim" if safe_value(column, "isHidden", False) else "Não",
                    "Formato": safe_value(column, "formatString", ""),
                    "Categoria": safe_value(column, "dataCategory", ""),
                    "Pasta": safe_value(column, "displayFolder", ""),
                    "Descricao": safe_value(column, "description", ""),
                })
        return rows

    def measures(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for table in self.tables_without_technical_dates():
            table_name = safe_value(table, "name", "")
            for measure in safe_list(table, "measures"):
                expression = safe_value(measure, "expression", "")
                rows.append({
                    "Medida": safe_value(measure, "name", ""),
                    "Tabela": table_name,
                    "Oculta": "Sim" if safe_value(measure, "isHidden", False) else "Não",
                    "Formato": safe_value(measure, "formatString", ""),
                    "Pasta": safe_value(measure, "displayFolder", ""),
                    "Tamanho DAX": len(safe_text(expression)),
                    "Expressao DAX": expression,
                    "Descricao": safe_value(measure, "description", ""),
                })
        return rows

    def source_rows(self, only_physical_tables: bool = False) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for table in self.tables_without_technical_dates():
            if only_physical_tables and not self.is_visible_physical_table(table):
                continue
            table_name = safe_value(table, "name", "")
            for partition in safe_list(table, "partitions"):
                expression = safe_value(partition, "expression", "")
                server, database = detect_database_server(expression)
                detected_source_type = display_source_type(self.detect_source_type(
                    expression,
                    safe_value(partition, "sourceType", ""),
                ))
                rows.append({
                    "Tabela": table_name,
                    "Particao": safe_value(partition, "name", ""),
                    "Fonte detectada": detected_source_type,
                    "Tipo fonte": display_source_type(translate_model_type(safe_value(partition, "sourceType", ""))),
                    "Modo": translate_model_type(safe_value(partition, "mode", "")),
                    "Servidor": server,
                    "Banco": database,
                    "SQL detectado": detect_sql_in_m_expression(expression),
                    "Expressao M": expression,
                })
        return rows

    def relationship_rows(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for relationship in self.relationships:
            from_table = safe_value(relationship, "fromTable", "")
            to_table = safe_value(relationship, "toTable", "")
            if self.is_technical_date_table_name(from_table) or self.is_technical_date_table_name(to_table):
                continue
            rows.append({
                "Tabela origem": to_table,
                "Coluna origem": safe_value(relationship, "toColumn", ""),
                "Tabela destino": from_table,
                "Coluna destino": safe_value(relationship, "fromColumn", ""),
                "Cardinalidade origem": safe_value(relationship, "toCardinality", ""),
                "Cardinalidade destino": safe_value(relationship, "fromCardinality", ""),
                "Direcao filtro": safe_value(relationship, "crossFilteringBehavior", ""),
                "Ativo": "Sim" if safe_value(relationship, "isActive", True) else "Não",
                "Relacionamento": safe_value(relationship, "name", ""),
            })
        return rows

    def quality_rows(self) -> list[dict[str, Any]]:
        if "quality_rows" in self._cache:
            return self._cache["quality_rows"]

        rows: list[dict[str, Any]] = []
        used_columns = self.columns_used_in_measures()

        for measure in self.measures():
            if not safe_text(measure.get("Descricao", "")).strip():
                rows.append({
                    "Severidade": "Baixa",
                    "Categoria": "Documentação",
                    "Item": f"{measure.get('Tabela', '')}.{measure.get('Medida', '')}",
                    "Diagnóstico": "Medida sem descrição.",
                    "Recomendação": "Descrever regra de negócio, granularidade e exceções da medida.",
                })
            if safe_value(measure, "Tamanho DAX", 0) >= 500:
                rows.append({
                    "Severidade": "Média",
                    "Categoria": "DAX",
                    "Item": f"{measure.get('Tabela', '')}.{measure.get('Medida', '')}",
                    "Diagnóstico": "Medida com expressão DAX longa.",
                    "Recomendação": "Revisar legibilidade, variáveis e possível decomposição em medidas auxiliares.",
                })

        for table in self.tables_without_technical_dates():
            table_name = safe_value(table, "name", "")
            if not safe_list(table, "partitions"):
                rows.append({
                    "Severidade": "Média",
                    "Categoria": "Estrutura",
                    "Item": table_name,
                    "Diagnóstico": "Tabela sem partição detectada.",
                    "Recomendação": "Confirmar se a tabela é válida ou se o export está incompleto.",
                })

            for column in safe_list(table, "columns"):
                column_name = safe_value(column, "name", "")
                if safe_value(column, "isHidden", False):
                    continue
                if (table_name, column_name) not in used_columns:
                    rows.append({
                        "Severidade": "Baixa",
                        "Categoria": "Uso",
                        "Item": f"{table_name}.{column_name}",
                        "Diagnóstico": "Coluna visível sem referência direta em medidas.",
                        "Recomendação": "Validar se a coluna deve permanecer visível para relatório ou autoatendimento.",
                    })

        for relationship in self.relationship_rows():
            direction = normalize_text(relationship.get("Direcao filtro", ""))
            if direction in {"bothdirections", "both", "ambas"}:
                rows.append({
                    "Severidade": "Alta",
                    "Categoria": "Relacionamento",
                    "Item": safe_value(relationship, "Relacionamento", ""),
                    "Diagnóstico": "Relacionamento com filtro bidirecional.",
                    "Recomendação": "Revisar impacto em ambiguidade, performance e resultados de medidas.",
                })

        self._cache["quality_rows"] = rows
        return rows

    def full_report(self) -> dict[str, Any]:
        return {
            "summary": self.summary(),
            "tables": self.table_rows(),
            "columns": self.column_rows(),
            "measures": self.measures(),
            "sources": self.source_rows(),
            "relationships": self.relationship_rows(),
            "quality": self.quality_rows(),
            "columnsUsedInMeasures": [
                {"Tabela": table, "Coluna": column}
                for table, column in sorted(self.columns_used_in_measures())
            ],
            "raw": {
                "dashboardName": safe_value(self.data, "dashboardName", ""),
                "modelName": safe_value(self.data, "modelName", ""),
                "exportDate": safe_value(self.data, "exportDate", ""),
            },
        }
