from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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
    columnsUsedInMeasures: list[Row]
    raw: RawModelInfo


class CompareFieldChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    campo: str
    antes: str
    depois: str


class CompareTableChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: str
    colunas_adicionadas: list[str]
    colunas_removidas: list[str]
    colunas_modificadas: list[str]
    medidas_adicionadas: list[str]
    medidas_removidas: list[str]
    medidas_modificadas: list[str]


class CompareColumnEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tabela: str
    coluna: str
    alteracoes: list[str] = Field(default_factory=list, alias="alterações")


class CompareMeasureEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tabela: str
    medida: str
    expressao_dax: str = ""
    antes: str = ""
    depois: str = ""


class CompareRelationshipEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relacionamento: str
    alteracoes: list[str] = Field(default_factory=list, alias="alterações")


class CompareGroup(BaseModel):
    adicionadas: list[str]
    removidas: list[str]
    modificadas: list[CompareTableChange]


class CompareColumnGroup(BaseModel):
    adicionadas: list[CompareColumnEntry]
    removidas: list[CompareColumnEntry]
    modificadas: list[CompareColumnEntry]


class CompareMeasureGroup(BaseModel):
    adicionadas: list[CompareMeasureEntry]
    removidas: list[CompareMeasureEntry]
    modificadas: list[CompareMeasureEntry]


class CompareRelationshipGroup(BaseModel):
    adicionados: list[str]
    removidos: list[str]
    modificados: list[CompareRelationshipEntry]


class CompareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboard_base: str
    dashboard_novo: str
    tabelas: CompareGroup
    medidas: CompareMeasureGroup
    colunas: CompareColumnGroup
    relacionamentos: CompareRelationshipGroup
