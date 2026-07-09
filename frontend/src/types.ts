export type Row = Record<string, string | number | boolean | null | undefined>;

export type AuthUser = {
  email: string;
  is_admin: boolean;
};

export type ManagedUser = {
  id: number;
  email: string;
  is_admin: boolean;
  disabled: boolean;
  created_at: string;
};

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

export type CompareResult = {
  dashboard_base: string;
  dashboard_novo: string;
  tabelas: {
    adicionadas: string[];
    removidas: string[];
    modificadas: CompareEntry[];
  };
  medidas: {
    adicionadas: CompareEntry[];
    removidas: CompareEntry[];
    modificadas: CompareEntry[];
  };
  colunas: {
    adicionadas: CompareEntry[];
    removidas: CompareEntry[];
    modificadas: CompareEntry[];
  };
  relacionamentos: {
    adicionados: string[];
    removidos: string[];
    modificados: CompareEntry[];
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
  | "compare"
  | "users";
