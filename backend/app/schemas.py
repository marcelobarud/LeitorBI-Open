from typing import Any

from pydantic import BaseModel, ConfigDict


Scalar = str | int | float | bool | None
Row = dict[str, Scalar]


class RawModelInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboardName: str
    modelName: str
    exportDate: str


class ReportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: Row
    tables: list[Row]
    columns: list[Row]
    measures: list[Row]
    sources: list[Row]
    relationships: list[Row]
    quality: list[Row]
    columnsUsedInMeasures: list[Row]
    raw: RawModelInfo


class CompareGroup(BaseModel):
    adicionadas: list[str]
    removidas: list[str]
    modificadas: list[dict[str, Any]]


class CompareColumnGroup(BaseModel):
    adicionadas: list[dict[str, Any]]
    removidas: list[dict[str, Any]]
    modificadas: list[dict[str, Any]]


class CompareMeasureGroup(BaseModel):
    adicionadas: list[dict[str, Any]]
    removidas: list[dict[str, Any]]
    modificadas: list[dict[str, Any]]


class CompareRelationshipGroup(BaseModel):
    adicionados: list[str]
    removidos: list[str]
    modificados: list[dict[str, Any]]


class CompareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboard_base: str
    dashboard_novo: str
    tabelas: CompareGroup
    medidas: CompareMeasureGroup
    colunas: CompareColumnGroup
    relacionamentos: CompareRelationshipGroup
