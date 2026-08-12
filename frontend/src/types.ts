export type Row = Record<string, string | number | boolean | null | undefined>;

export type Report = {
  summary: Row;
  tables: Row[];
  columns: Row[];
  measures: Row[];
  sources: Row[];
  relationships: Row[];
  columnsUsedInMeasures: Row[];
  raw: {
    dashboardName: string;
    modelName: string;
    exportDate: string;
  };
};

export type CompareEntry = Record<string, string | string[] | number | boolean | null | undefined>;

export type CompareTableChange = CompareEntry & {
  nome: string;
  colunas_adicionadas: string[];
  colunas_removidas: string[];
  colunas_modificadas: string[];
  medidas_adicionadas: string[];
  medidas_removidas: string[];
  medidas_modificadas: string[];
};

export type CompareColumnChange = CompareEntry & {
  tabela: string;
  coluna: string;
  alteracoes?: string[];
  alterações?: string[];
};

export type CompareMeasureChange = CompareEntry & {
  tabela: string;
  medida: string;
  expressao_dax?: string;
  antes?: string;
  depois?: string;
};

export type CompareRelationshipChange = CompareEntry & {
  relacionamento: string;
  alteracoes?: string[];
  alterações?: string[];
};

export type CompareResult = {
  dashboard_base: string;
  dashboard_novo: string;
  tabelas: {
    adicionadas: string[];
    removidas: string[];
    modificadas: CompareTableChange[];
  };
  medidas: {
    adicionadas: CompareMeasureChange[];
    removidas: CompareMeasureChange[];
    modificadas: CompareMeasureChange[];
  };
  colunas: {
    adicionadas: CompareColumnChange[];
    removidas: CompareColumnChange[];
    modificadas: CompareColumnChange[];
  };
  relacionamentos: {
    adicionados: string[];
    removidos: string[];
    modificados: CompareRelationshipChange[];
  };
};

export type TabKey =
  | "overview"
  | "tutorial"
  | "tables"
  | "columns"
  | "measures"
  | "sources"
  | "relationships"
  | "compare";
