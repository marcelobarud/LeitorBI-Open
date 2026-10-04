from __future__ import annotations

from copy import deepcopy
import json
from typing import Any

from app.ingestion.json_reader import read_json_model
from app.ingestion.normalization import NORMALIZATION_KEY, UNKNOWN, is_generated_date_table_name
from app.ingestion.tmdl_reader import read_tmdl_model
from app.ingestion.tmsl_reader import read_tmsl_model
from app.schemas import CompareResponse
from app.services.compare import compare_models
from app.services.analyzer import PowerBIAnalyzer


MULTILINE_DAX = "VAR Total =\n    SUM('Tabela Regular'[Valor])\nRETURN\n    Total"
MULTILINE_M = 'let\n    Source = Sql.Database("server", "database")\nin\n    Source'


def _json_model() -> dict[str, Any]:
    return {
        "dashboardName": "Equivalência",
        "modelName": "Model",
        "exportDate": "",
        "modelMetadata": {"culture": "pt-BR", "defaultMode": "import"},
        "tables": [
            {
                "name": "Tabela Regular",
                "tableType": "regular",
                "description": "Descrição explícita",
                "columns": [
                    {
                        "name": "Id",
                        "dataType": "int64",
                        "columnType": "DataColumn",
                        "isHidden": True,
                        "summarizeBy": "none",
                    },
                    {
                        "name": "Valor",
                        "dataType": "double",
                        "columnType": "DataColumn",
                        "displayFolder": "Valores",
                    },
                    {
                        "name": "Ano",
                        "dataType": "int64",
                        "columnType": "CalculatedColumn",
                    },
                ],
                "measures": [
                    {
                        "name": "Total",
                        "expression": MULTILINE_DAX,
                        "formatString": "#,##0",
                    }
                ],
                "partitions": [
                    {
                        "name": "Tabela Regular",
                        "sourceType": "m",
                        "mode": "import",
                        "expression": MULTILINE_M,
                    }
                ],
            },
                    {
                        "name": "Tabela Calculada",
                        "tableType": "calculatedtable",
                        "isHidden": True,
                        "columns": [
                            {
                                "name": "Id",
                                "dataType": "int64",
                                "columnType": "CalculatedTableColumn",
                            }
                        ],
                        "partitions": [
                    {
                        "name": "Tabela Calculada",
                        "sourceType": "calculated",
                        "mode": "dual",
                        "expression": "CALENDAR(DATE(2024, 1, 1), DATE(2024, 12, 31))",
                    }
                ],
            },
        ],
        "relationships": [
            {
                "name": "Regular Calculada",
                "fromTable": "Tabela Regular",
                "fromColumn": "Id",
                "toTable": "Tabela Calculada",
                "toColumn": "Id",
                "fromCardinality": "many",
                "toCardinality": "one",
                "crossFilteringBehavior": "bothDirections",
                "securityFilteringBehavior": "oneDirection",
                "isActive": False,
            }
        ],
    }


def _tmsl_model() -> bytes:
    from copy import deepcopy
    import json

    model = deepcopy(_json_model())
    for table in model["tables"]:
        table["partitions"] = [
            {
                "name": partition["name"],
                "mode": partition["mode"],
                "source": {
                    "type": partition["sourceType"],
                    "expression": partition["expression"],
                },
            }
            for partition in table["partitions"]
        ]
    return json.dumps(
        {
            "name": model["modelName"],
            "model": {
                "culture": model["modelMetadata"]["culture"],
                "defaultMode": model["modelMetadata"]["defaultMode"],
                "tables": model["tables"],
                "relationships": model["relationships"],
            },
        }
    ).encode("utf-8")


def _tmdl_files() -> dict[str, bytes]:
    return {
        "definition/model.tmdl": b"""
model Model
    culture: pt-BR
    defaultMode: import
""",
        "definition/relationships.tmdl": b"""
relationship 'Regular Calculada'
    fromColumn: 'Tabela Regular'.Id
    toColumn: 'Tabela Calculada'.Id
    fromCardinality: many
    toCardinality: one
    crossFilteringBehavior: bothDirections
    securityFilteringBehavior: oneDirection
    isActive: false
""",
        "definition/tables/regular.tmdl": f"""
table 'Tabela Regular'
    description: 'Descrição explícita'
    column Id
        dataType: int64
        isHidden
        summarizeBy: none
    column Valor
        dataType: double
        displayFolder: Valores
    column Ano = ```
        YEAR([Data])
        ```
        dataType: int64
    measure Total = ```
        {MULTILINE_DAX}
        ```
        formatString: #,##0
    partition 'Tabela Regular' = m
        mode: import
        source = ```
            {MULTILINE_M}
            ```
""".encode("utf-8"),
        "definition/tables/calculated.tmdl": b"""
table 'Tabela Calculada'
    isHidden
    column Id
        dataType: int64
    partition 'Tabela Calculada' = calculated
        mode: dual
        source = CALENDAR(DATE(2024, 1, 1), DATE(2024, 12, 31))
""",
    }


def _phase_a_json_model() -> dict[str, Any]:
    return {
        "dashboardName": "Fixture canônica",
        "modelName": "Model",
        "exportDate": "",
        "modelMetadata": {"culture": "pt-BR", "defaultMode": "import"},
        "tables": [
            {
                "name": "Sales",
                "tableType": "Regular",
                "description": "Tabela comercial\ncom segunda linha",
                "columns": [
                    {"name": "Id", "dataType": "Int64", "columnType": "Data"},
                    {"name": "OrderDate", "dataType": "DateTime", "columnType": "DataColumn"},
                    {"name": "EventDate", "dataType": "DateTime", "columnType": "DataColumn", "isHidden": True, "description": "Data usada na relação"},
                    {"name": "Amount", "dataType": "Decimal", "columnType": "DataColumn"},
                    {"name": "NetAmount", "dataType": "Double", "columnType": "CalculatedColumn"},
                ],
                "measures": [{
                    "name": "Total Amount", "expression": "SUM('Sales'[Amount])", "dataType": "Double",
                    "formatString": "#,##0.00", "displayFolder": "Sales metrics",
                    "description": "Total bruto calculado",
                }],
                "partitions": [{"name": "Sales", "sourceType": "M", "mode": "Import", "expression": MULTILINE_M}],
            },
            {
                "name": "Calendar",
                "tableType": "CalculatedTable",
                "columns": [
                    {"name": "Date", "dataType": "DateTime", "columnType": "CalculatedTableColumn"},
                    {"name": "Year", "dataType": "Int64", "columnType": "CalculatedColumn"},
                ],
                "partitions": [{"name": "Calendar", "sourceType": "Calculated", "mode": "Import", "expression": "CALENDAR(DATE(2024, 1, 1), DATE(2024, 12, 31))"}],
            },
            {
                "name": "LocalDateTable_00000000-0000-0000-0000-000000000001",
                "tableType": "CalculatedTable", "isHidden": True, "isAutoGenerated": True,
                "columns": [{"name": "Date", "dataType": "DateTime", "columnType": "CalculatedTableColumn"}],
                "partitions": [{"name": "LocalDateTable_00000000-0000-0000-0000-000000000001", "sourceType": "Calculated", "mode": "Import", "expression": "CALENDAR(DATE(2024, 1, 1), DATE(2024, 12, 31))"}],
            },
            {"name": "LocalDateTable_custom", "columns": [{"name": "Value", "dataType": "Int64", "columnType": "DataColumn"}]},
        ],
        "relationships": [
            {
                "name": "Sales EventDate Calendar Date", "fromTable": "Sales", "fromColumn": "EventDate",
                "toTable": "Calendar", "toColumn": "Date", "fromCardinality": "Many", "toCardinality": "One",
                "crossFilteringBehavior": "OneDirection", "securityFilteringBehavior": "OneDirection", "isActive": True,
            },
            {
                "name": "Sales OrderDate Calendar Date", "fromTable": "Sales", "fromColumn": "OrderDate",
                "toTable": "Calendar", "toColumn": "Date", "fromCardinality": "Many", "toCardinality": "One",
                "crossFilteringBehavior": "OneDirection", "securityFilteringBehavior": "OneDirection", "isActive": True,
            },
        ],
    }


def _phase_a_tmsl_model() -> bytes:
    source = deepcopy(_phase_a_json_model())
    for table in source["tables"]:
        table["partitions"] = [
            {
                "name": partition["name"], "mode": partition["mode"],
                "source": {"type": partition["sourceType"], "expression": partition["expression"]},
            }
            for partition in table.get("partitions", [])
        ]
    return json.dumps({
        "name": "Model",
        "model": {
            "culture": "pt-BR", "defaultMode": "import", "tables": source["tables"],
            "relationships": source["relationships"],
        },
    }).encode("utf-8")


def _phase_a_tmdl_files() -> dict[str, bytes]:
    return {
        "definition/model.tmdl": b"""
model Model
    culture: pt-BR
    defaultMode: import
""",
        "definition/relationships.tmdl": b"""
relationship 'Sales EventDate Calendar Date'
    fromColumn: Sales.EventDate
    toColumn: Calendar.Date
    fromCardinality: many
    toCardinality: one
    crossFilteringBehavior: oneDirection
    securityFilteringBehavior: oneDirection
    isActive

relationship 'Sales OrderDate Calendar Date'
    fromColumn: Sales.OrderDate
    toColumn: Calendar.Date
""",
        "definition/tables/sales.tmdl": f"""
/// Tabela comercial
/// com segunda linha
table Sales
    column Id
        dataType: int64
    column OrderDate
        dataType: dateTime
    /// Data usada na relação
    column EventDate
        dataType: dateTime
        isHidden
    column Amount
        dataType: decimal
    column NetAmount = [Amount] * 0.9
        dataType: double
    /// Total bruto calculado
    measure 'Total Amount' = SUM('Sales'[Amount])
        formatString: #,##0.00
        displayFolder: 'Sales metrics'
    partition Sales = m
        mode: import
        source = ```
            {MULTILINE_M}
            ```
""".encode("utf-8"),
        "definition/tables/calendar.tmdl": b"""
table Calendar
    column Date
        dataType: dateTime
    column Year = YEAR('Calendar'[Date])
    partition Calendar = calculated
        mode: import
        source = CALENDAR(DATE(2024, 1, 1), DATE(2024, 12, 31))
""",
        "definition/tables/local-date.tmdl": b"""
table LocalDateTable_00000000-0000-0000-0000-000000000001
    isHidden
    column Date
        dataType: dateTime
    partition LocalDateTable_00000000-0000-0000-0000-000000000001 = calculated
        mode: import
        source = CALENDAR(DATE(2024, 1, 1), DATE(2024, 12, 31))
""",
        "definition/tables/user-date.tmdl": b"""
// ordinary comment is not a description
table LocalDateTable_custom
    column Value
        dataType: int64
""",
    }


def _unfenced_tmdl_files() -> dict[str, bytes]:
    return {
        "definition/model.tmdl": b"""
model Model
    culture: pt-BR
    defaultMode: import
""",
        "definition/tables/unfenced.tmdl": r"""
table 'Tabela'
    column Valor
        dataType: decimal
    measure 'Medida Simples' = SUM('Tabela'[Valor])
    measure 'Medida Completa' =
        VAR Texto = "a=b"
        // comentário DAX que precisa permanecer na expressão
        VAR Base =
            CALCULATE(
                SUM('Tabela'[Valor]),
                FILTER('Tabela', 'Tabela'[Valor] = 1)
            )
        RETURN
            Base + [Outra Medida]
        formatString: #,##0.00
        displayFolder: Indicadores
    partition 'Tabela' = m
        mode: import
        source =
            let
                Source = File.Contents("C:\dados\arquivo.bin"),
                Navegacao = Source,
            in
                Navegacao
""".encode("utf-8"),
    }


def _public_model_projection(data: dict[str, Any]) -> dict[str, Any]:
    def entity(item: dict[str, Any], fields: tuple[str, ...]) -> dict[str, Any]:
        return {field: item.get(field) for field in fields}

    return {
        "metadata": data["modelMetadata"],
        "tables": [
            {
                **entity(table, ("name", "tableType", "isHidden", "description")),
                "columns": [
                    entity(
                        column,
                        ("name", "dataType", "columnType", "isHidden", "formatString", "displayFolder", "summarizeBy"),
                    )
                    for column in sorted(table["columns"], key=lambda item: item["name"])
                ],
                "measures": [
                    entity(measure, ("name", "normalizedExpression", "formatString", "isHidden"))
                    for measure in sorted(table["measures"], key=lambda item: item["name"])
                ],
                "partitions": [
                    entity(partition, ("name", "sourceType", "mode", "normalizedExpression"))
                    for partition in sorted(table["partitions"], key=lambda item: item["name"])
                ],
            }
            for table in sorted(data["tables"], key=lambda item: item["name"])
        ],
        "relationships": [
            entity(
                relationship,
                (
                    "name",
                    "fromTable",
                    "fromColumn",
                    "toTable",
                    "toColumn",
                    "fromCardinality",
                    "toCardinality",
                    "crossFilteringBehavior",
                    "securityFilteringBehavior",
                    "isActive",
                ),
            )
            for relationship in sorted(data["relationships"], key=lambda item: item["name"])
        ],
    }


def test_json_tmsl_and_tmdl_produce_equivalent_canonical_values():
    json_model = read_json_model(_json_model())
    tmsl_model = read_tmsl_model(_tmsl_model(), dashboard_name="Equivalência", model_name="Model")
    tmdl_model = read_tmdl_model(_tmdl_files(), dashboard_name="Equivalência", model_name="Model")

    assert _public_model_projection(json_model) == _public_model_projection(tmsl_model)
    assert _public_model_projection(json_model) == _public_model_projection(tmdl_model)
    assert json_model["modelMetadata"]["defaultMode"] == "Import"
    tmdl_regular = next(table for table in tmdl_model["tables"] if table["name"] == "Tabela Regular")
    tmdl_calculated = next(table for table in tmdl_model["tables"] if table["name"] == "Tabela Calculada")
    assert tmdl_calculated["tableType"] == "CalculatedTable"
    assert tmdl_regular["columns"][0]["isHidden"] is True
    assert tmdl_regular["columns"][2]["columnType"] == "CalculatedColumn"


def test_unfenced_tmdl_preserves_complete_dax_m_and_metadata_boundaries():
    model = read_tmdl_model(_unfenced_tmdl_files(), dashboard_name="Equivalência", model_name="Model")
    table = model["tables"][0]
    simple_measure = next(measure for measure in table["measures"] if measure["name"] == "Medida Simples")
    measure = next(measure for measure in table["measures"] if measure["name"] == "Medida Completa")
    partition = table["partitions"][0]

    assert simple_measure["expression"] == "SUM('Tabela'[Valor])"
    assert "VAR Texto = \"a=b\"" in measure["expression"]
    assert "// comentário DAX" in measure["expression"]
    assert "FILTER('Tabela', 'Tabela'[Valor] = 1)" in measure["expression"]
    assert "formatString:" not in measure["expression"]
    assert measure["formatString"] == "#,##0.00"
    assert measure["displayFolder"] == "Indicadores"
    assert partition["expression"].startswith("let\n    Source = File.Contents")
    assert "Navegacao = Source" in partition["expression"]
    assert PowerBIAnalyzer(model).source_rows()[0]["Fonte detectada"] == "Arquivo"


def test_source_detector_is_shared_by_json_tmsl_and_tmdl():
    json_model = read_json_model(_json_model())
    tmsl_model = read_tmsl_model(_tmsl_model(), dashboard_name="Equivalência", model_name="Model")
    tmdl_model = read_tmdl_model(_tmdl_files(), dashboard_name="Equivalência", model_name="Model")

    projections = []
    for model in (json_model, tmsl_model, tmdl_model):
        row = next(row for row in PowerBIAnalyzer(model).source_rows() if row["Fonte detectada"] == "SQL")
        projections.append((row["Fonte detectada"], row["Servidor"], row["Banco"], row["Modo"]))

    assert projections == [("SQL", "server", "database", "Importado")] * 3


def test_source_detector_covers_file_and_common_connector_variants():
    analyzer = PowerBIAnalyzer({"tables": [], "relationships": []})
    cases = {
        'let Source = Sql.Database("server", "db") in Source': "SQL",
        'let Source = Sql.Database("server.database.windows.net", "db") in Source': "Azure SQL / Synapse",
        'let Source = Folder.Files("C:/dados") in Source': "Pasta",
        'let Source = File.Contents("C:/dados/arquivo.bin") in Source': "Arquivo",
        'let Source = Excel.Workbook(File.Contents("C:/dados/arquivo.xlsx")) in Source': "Excel",
        'let Source = Csv.Document(File.Contents("C:/dados/arquivo.csv")) in Source': "CSV",
        'let Source = SharePoint.Files("https://contoso.sharepoint.com/sites/dados") in Source': "SharePoint",
        'let Source = OData.Feed("https://contoso.example/odata") in Source': "OData",
    }

    for expression, expected in cases.items():
        assert analyzer.detect_source_type(expression, "M") == expected


def test_source_report_redacts_sensitive_m_values_without_affecting_detection():
    expression = (
        'let Source = Sql.Database("server", "database", [Query="select 1", '
        'Password="password-secret", Token="token-secret", Key="key-secret", '
        'Authorization="Bearer bearer-secret"]), '
        'File = Web.Contents("https://contoso.example/data/arquivo.csv?sig=sas-secret&se=2026-01-01&foo=preserve"), '
        'in File'
    )
    model = read_json_model({
        "tables": [{
            "name": "Tabela",
            "partitions": [{"name": "Tabela", "sourceType": "M", "mode": "import", "expression": expression}],
        }],
        "relationships": [],
    })

    canonical_expression = model["tables"][0]["partitions"][0]["expression"]
    report_row = PowerBIAnalyzer(model).source_rows()[0]
    report_expression = report_row["Expressao M"]
    assert "password-secret" in canonical_expression
    assert "token-secret" in canonical_expression
    assert "key-secret" in canonical_expression
    assert "bearer-secret" in canonical_expression
    assert "sas-secret" in canonical_expression
    assert "password-secret" not in report_expression
    assert "token-secret" not in report_expression
    assert "key-secret" not in report_expression
    assert "bearer-secret" not in report_expression
    assert "sas-secret" not in report_expression
    assert "server" == report_row["Servidor"]
    assert "database" == report_row["Banco"]
    assert "arquivo.csv" in report_expression
    assert "foo=preserve" in report_expression
    assert report_row["Fonte detectada"] == "SQL"


def test_tmdl_presence_booleans_keep_explicit_and_default_sources():
    model = read_tmdl_model(_tmdl_files(), dashboard_name="Equivalência", model_name="Model")
    regular = next(table for table in model["tables"] if table["name"] == "Tabela Regular")
    calculated = next(table for table in model["tables"] if table["name"] == "Tabela Calculada")

    assert regular["isHidden"] is False
    assert regular[NORMALIZATION_KEY]["fields"]["isHidden"] == "default"
    assert regular["columns"][0]["isHidden"] is True
    assert regular["columns"][0][NORMALIZATION_KEY]["fields"]["isHidden"] == "explicit"
    assert calculated["isHidden"] is True


def test_tmdl_auto_generated_flag_presence_is_explicit_and_date_inference_requires_hidden():
    files = _phase_a_tmdl_files()
    files["definition/tables/explicit-auto.tmdl"] = b"""
table ExplicitlyMarked
    isAutoGenerated
"""
    files["definition/tables/unhidden-date.tmdl"] = b"""
table LocalDateTable_00000000-0000-0000-0000-000000000002
"""

    model = read_tmdl_model(files, dashboard_name="Fixture canônica", model_name="Model")
    tables = {table["name"]: table for table in model["tables"]}

    assert tables["ExplicitlyMarked"]["isAutoGenerated"] is True
    assert tables["ExplicitlyMarked"][NORMALIZATION_KEY]["fields"]["isAutoGenerated"] == "explicit"
    assert tables["LocalDateTable_00000000-0000-0000-0000-000000000002"]["isAutoGenerated"] is False


def test_relationship_missing_values_remain_unknown_instead_of_invented_defaults():
    files = _tmdl_files()
    files["definition/relationships.tmdl"] = b"""
relationship 'Sem propriedades'
    fromColumn: 'Tabela Regular'.Id
    toColumn: 'Tabela Calculada'.Id
"""
    model = read_tmdl_model(files, dashboard_name="Equivalência", model_name="Model")
    relationship = model["relationships"][0]

    assert relationship["fromCardinality"] == ""
    assert relationship["toCardinality"] == ""
    assert relationship["crossFilteringBehavior"] == "OneDirection"
    assert relationship["isActive"] is True
    assert relationship[NORMALIZATION_KEY]["normalized"]["fromCardinality"] == UNKNOWN
    assert relationship[NORMALIZATION_KEY]["fields"]["crossFilteringBehavior"] == "default"
    assert relationship[NORMALIZATION_KEY]["fields"]["isActive"] == "default"


def test_phase_a_equivalence_fixtures_cover_json_tmsl_and_tmdl_semantics():
    json_model = read_json_model(_phase_a_json_model())
    tmsl_model = read_tmsl_model(_phase_a_tmsl_model(), dashboard_name="Fixture canônica", model_name="Model")
    tmdl_model = read_tmdl_model(_phase_a_tmdl_files(), dashboard_name="Fixture canônica", model_name="Model")

    assert _public_model_projection(json_model) == _public_model_projection(tmsl_model)

    json_tables = {table["name"]: table for table in json_model["tables"]}
    tmdl_tables = {table["name"]: table for table in tmdl_model["tables"]}
    assert {name: table["tableType"] for name, table in json_tables.items()} == {
        name: table["tableType"] for name, table in tmdl_tables.items()
    }
    assert tmdl_tables["Sales"]["description"] == "Tabela comercial\ncom segunda linha"
    assert tmdl_tables["Sales"]["columns"][0]["columnType"] == "DataColumn"
    assert tmdl_tables["Calendar"]["columns"][0]["columnType"] == "CalculatedTableColumn"
    assert tmdl_tables["Calendar"]["columns"][1]["columnType"] == "CalculatedColumn"
    assert tmdl_tables["Sales"]["columns"][2]["isHidden"] is True
    assert tmdl_tables["Sales"]["columns"][2]["description"] == "Data usada na relação"
    assert tmdl_tables["Sales"]["measures"][0]["description"] == "Total bruto calculado"
    assert tmdl_tables["Sales"]["measures"][0]["normalizedExpression"] == "SUM('Sales'[Amount])"
    assert tmdl_tables["Sales"]["partitions"][0]["sourceType"] == "M"
    assert tmdl_tables["Calendar"]["partitions"][0]["sourceType"] == "Calculated"

    generated_name = "LocalDateTable_00000000-0000-0000-0000-000000000001"
    assert tmdl_tables[generated_name]["isHidden"] is True
    assert tmdl_tables[generated_name]["isAutoGenerated"] is True
    assert tmdl_tables[generated_name][NORMALIZATION_KEY]["fields"]["isAutoGenerated"] == "inferred"
    assert tmdl_tables["LocalDateTable_custom"]["isAutoGenerated"] is False
    assert not is_generated_date_table_name("LocalDateTable_custom")
    assert is_generated_date_table_name("DateTableTemplate_00000000-0000-0000-0000-000000000001")
    assert tmdl_tables["LocalDateTable_custom"]["description"] == ""

    year_column = tmdl_tables["Calendar"]["columns"][1]
    total_measure = tmdl_tables["Sales"]["measures"][0]
    assert year_column["dataType"] == ""
    assert year_column[NORMALIZATION_KEY]["fields"]["dataType"] == "unknown"
    assert total_measure["dataType"] == ""
    assert total_measure[NORMALIZATION_KEY]["fields"]["dataType"] == "unknown"

    json_relationships = {item["name"]: item for item in json_model["relationships"]}
    tmdl_relationships = {item["name"]: item for item in tmdl_model["relationships"]}
    assert set(json_relationships) == set(tmdl_relationships)
    defaulted = tmdl_relationships["Sales OrderDate Calendar Date"]
    assert defaulted["crossFilteringBehavior"] == "OneDirection"
    assert defaulted["isActive"] is True
    assert defaulted[NORMALIZATION_KEY]["fields"]["fromCardinality"] == "unknown"
    assert defaulted[NORMALIZATION_KEY]["fields"]["toCardinality"] == "unknown"
    assert defaulted[NORMALIZATION_KEY]["fields"]["crossFilteringBehavior"] == "default"
    assert defaulted[NORMALIZATION_KEY]["fields"]["isActive"] == "default"

    result = compare_models(json_model, tmdl_model)
    assert result["tabelas"]["adicionadas"] == []
    assert result["tabelas"]["removidas"] == []
    assert result["tabelas"]["modificadas"] == []
    assert result["colunas"]["modificadas"] == []
    assert result["medidas"]["modificadas"] == []
    assert result["relacionamentos"]["modificados"] == []


def test_known_data_type_difference_remains_a_real_column_change():
    base = _phase_a_json_model()
    newer = deepcopy(base)
    newer["tables"][0]["columns"][3]["dataType"] = "Int64"

    result = compare_models(read_json_model(base), read_json_model(newer))

    assert [(item["tabela"], item["coluna"]) for item in result["colunas"]["modificadas"]] == [
        ("Sales", "Amount")
    ]


def test_explicit_relationship_value_different_from_tmdl_default_is_reported():
    json_model = _phase_a_json_model()
    json_model["relationships"][1]["isActive"] = False

    result = compare_models(
        read_json_model(json_model),
        read_tmdl_model(_phase_a_tmdl_files(), dashboard_name="Fixture canônica", model_name="Model"),
    )

    assert len(result["relacionamentos"]["modificados"]) == 1
    assert "ativo: False -> True" in result["relacionamentos"]["modificados"][0]["alterações"][0]


def test_source_format_metadata_is_not_a_semantic_model_difference():
    base = read_json_model(_phase_a_json_model())
    newer_source = deepcopy(_phase_a_json_model())
    newer_source.update({"dashboardName": "Outro nome", "modelName": "Outro ID", "exportDate": "2026-01-01"})
    newer_source["modelMetadata"]["compatibilityLevel"] = 1601

    result = compare_models(base, read_json_model(newer_source))

    assert result["tabelas"]["modificadas"] == []
    assert result["colunas"]["modificadas"] == []
    assert result["medidas"]["modificadas"] == []
    assert result["relacionamentos"]["modificados"] == []


def test_partition_m_change_is_reported_without_exposing_expression():
    base = read_json_model(_phase_a_json_model())
    changed = deepcopy(_phase_a_json_model())
    changed["tables"][0]["partitions"][0]["expression"] = (
        'let\n    Source = Sql.Database("server", "database"),\n'
        '    #"Removed Duplicates" = Table.Distinct(Source, {"TicketNo", "VehicleID"})\n'
        'in\n    #"Removed Duplicates"'
    )

    result = compare_models(base, read_json_model(changed))

    sales_change = next(item for item in result["tabelas"]["modificadas"] if item["nome"] == "Sales")
    assert sales_change["particoes_modificadas"] == ["Sales"]
    assert "Table.Distinct" not in str(sales_change)
    assert CompareResponse.model_validate(result).tabelas.modificadas[0].particoes_modificadas == ["Sales"]


def test_relationship_key_preserves_duplicate_endpoints_with_name_discriminator():
    source = _json_model()
    duplicate = dict(source["relationships"][0])
    duplicate["name"] = "Outra relação"
    source["relationships"].append(duplicate)
    model = read_json_model(source)

    keys = [relationship[NORMALIZATION_KEY]["relationshipKey"] for relationship in model["relationships"]]
    assert len(keys) == len(set(keys))
    assert all("|name:" in key for key in keys)


def test_compare_uses_canonical_enums_and_normalized_expressions():
    base = read_json_model(_json_model())
    novo = read_tmdl_model(_tmdl_files(), dashboard_name="Equivalência", model_name="Model")

    result = compare_models(base, novo)

    assert result["tabelas"]["adicionadas"] == []
    assert result["tabelas"]["removidas"] == []
    assert result["tabelas"]["modificadas"] == []
    assert result["colunas"]["modificadas"] == []
    assert result["medidas"]["modificadas"] == []
    assert result["relacionamentos"]["modificados"] == []
