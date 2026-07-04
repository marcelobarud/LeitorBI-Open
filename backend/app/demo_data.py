DEMO_MODEL = {
    "dashboardName": "Demo Comercial",
    "modelName": "Modelo Vendas 2026",
    "exportDate": "2026-07-03",
    "modelMetadata": {
        "culture": "pt-BR",
        "defaultMode": "Import",
    },
    "tables": [
        {
            "name": "Fato Vendas",
            "tableType": "Regular",
            "isHidden": False,
            "columns": [
                {"name": "Id Venda", "dataType": "Int64", "columnType": "DataColumn", "isHidden": True},
                {"name": "Data", "dataType": "DateTime", "columnType": "DataColumn", "isHidden": False},
                {"name": "Id Produto", "dataType": "Int64", "columnType": "DataColumn", "isHidden": True},
                {"name": "Id Cliente", "dataType": "Int64", "columnType": "DataColumn", "isHidden": True},
                {"name": "Receita", "dataType": "Decimal", "columnType": "DataColumn", "isHidden": False, "formatString": "R$ #,0.00"},
                {"name": "Quantidade", "dataType": "Int64", "columnType": "DataColumn", "isHidden": False},
            ],
            "measures": [
                {
                    "name": "Receita Total",
                    "expression": "SUM('Fato Vendas'[Receita])",
                    "formatString": "R$ #,0.00",
                    "displayFolder": "Financeiro",
                },
                {
                    "name": "Ticket Medio",
                    "expression": "DIVIDE([Receita Total], DISTINCTCOUNT('Fato Vendas'[Id Venda]))",
                    "formatString": "R$ #,0.00",
                    "displayFolder": "Financeiro",
                },
            ],
            "partitions": [
                {
                    "name": "Fato Vendas",
                    "sourceType": "M",
                    "mode": "Import",
                    "expression": 'let Source = Sql.Database("srv-bi", "DW_Comercial", [Query="select * from dbo.fato_vendas"]) in Source',
                }
            ],
        },
        {
            "name": "Dim Produto",
            "tableType": "Regular",
            "isHidden": False,
            "columns": [
                {"name": "Id Produto", "dataType": "Int64", "columnType": "DataColumn", "isHidden": True},
                {"name": "Produto", "dataType": "String", "columnType": "DataColumn", "isHidden": False},
                {"name": "Categoria", "dataType": "String", "columnType": "DataColumn", "isHidden": False},
            ],
            "measures": [],
            "partitions": [
                {
                    "name": "Dim Produto",
                    "sourceType": "M",
                    "mode": "Import",
                    "expression": 'let Source = Excel.Workbook(File.Contents("produtos.xlsx")) in Source',
                }
            ],
        },
        {
            "name": "Dim Cliente",
            "tableType": "Regular",
            "isHidden": False,
            "columns": [
                {"name": "Id Cliente", "dataType": "Int64", "columnType": "DataColumn", "isHidden": True},
                {"name": "Cliente", "dataType": "String", "columnType": "DataColumn", "isHidden": False},
                {"name": "Regiao", "dataType": "String", "columnType": "DataColumn", "isHidden": False},
            ],
            "measures": [],
            "partitions": [
                {
                    "name": "Dim Cliente",
                    "sourceType": "M",
                    "mode": "Import",
                    "expression": 'let Source = SharePoint.Files("https://contoso.sharepoint.com/sites/comercial") in Source',
                }
            ],
        },
        {
            "name": "Calendario",
            "tableType": "CalculatedTable",
            "isHidden": False,
            "columns": [
                {"name": "Data", "dataType": "DateTime", "columnType": "DataColumn", "isHidden": False},
                {"name": "Ano", "dataType": "Int64", "columnType": "CalculatedColumn", "isHidden": False},
                {"name": "Mes", "dataType": "String", "columnType": "CalculatedColumn", "isHidden": False},
            ],
            "measures": [
                {
                    "name": "Receita YTD",
                    "expression": "TOTALYTD([Receita Total], 'Calendario'[Data])",
                    "formatString": "R$ #,0.00",
                    "displayFolder": "Tempo",
                }
            ],
            "partitions": [
                {
                    "name": "Calendario",
                    "sourceType": "Calculated",
                    "mode": "Import",
                    "expression": "CALENDAR(DATE(2024,1,1), DATE(2026,12,31))",
                }
            ],
        },
    ],
    "relationships": [
        {
            "name": "Vendas Produto",
            "fromTable": "Fato Vendas",
            "fromColumn": "Id Produto",
            "toTable": "Dim Produto",
            "toColumn": "Id Produto",
            "fromCardinality": "Many",
            "toCardinality": "One",
            "crossFilteringBehavior": "OneDirection",
            "isActive": True,
        },
        {
            "name": "Vendas Cliente",
            "fromTable": "Fato Vendas",
            "fromColumn": "Id Cliente",
            "toTable": "Dim Cliente",
            "toColumn": "Id Cliente",
            "fromCardinality": "Many",
            "toCardinality": "One",
            "crossFilteringBehavior": "OneDirection",
            "isActive": True,
        },
        {
            "name": "Vendas Calendario",
            "fromTable": "Fato Vendas",
            "fromColumn": "Data",
            "toTable": "Calendario",
            "toColumn": "Data",
            "fromCardinality": "Many",
            "toCardinality": "One",
            "crossFilteringBehavior": "BothDirections",
            "isActive": False,
        },
    ],
}
