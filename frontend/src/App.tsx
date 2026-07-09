import {
  AlertTriangle,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  Filter,
  LogOut,
  Maximize2,
  Minimize2,
  FileJson,
  GitCompareArrows,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  UserPlus,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Component,
  Fragment,
  type ChangeEvent,
  type ErrorInfo,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  analyzeModel,
  analyzePublicDemoModel,
  compareModels,
  createUser,
  deleteUser,
  exportModelExcel,
  getCurrentUser,
  listUsers,
  login as loginUser,
  logout as logoutUser,
  registerUser,
  updateUser,
} from "./api";
import { LoginPopover } from "./components/LoginPopover";
import { LandingPage } from "./pages/LandingPage";
import { ROUTES, routeFromPath, type AppRoute } from "./routes";
import type { AuthUser, CompareEntry, CompareResult, ManagedUser, Report, Row, TabKey } from "./types";

type DataTabKey = Exclude<TabKey, "overview" | "tutorial" | "compare" | "users">;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Início" },
  { key: "tutorial", label: "Tutorial" },
  { key: "tables", label: "Tabelas" },
  { key: "columns", label: "Colunas" },
  { key: "measures", label: "Medidas" },
  { key: "sources", label: "Fontes" },
  { key: "relationships", label: "Relações" },
  { key: "compare", label: "Comparar" },
];

const adminTabs: Array<{ key: TabKey; label: string }> = [{ key: "users", label: "Usuários" }];

const demoTabs: Array<{ key: Exclude<TabKey, "tutorial" | "compare" | "users">; label: string }> = [
  { key: "overview", label: "Resumo" },
  { key: "tables", label: "Tabelas" },
  { key: "columns", label: "Colunas" },
  { key: "measures", label: "Medidas" },
  { key: "sources", label: "Fontes" },
  { key: "relationships", label: "Relacoes" },
];

const PAGE_SIZE = 250;
const UNIQUE_FILTER_LIMIT = 120;
const MAX_JSON_UPLOAD_MB = 10;
const MAX_JSON_UPLOAD_BYTES = MAX_JSON_UPLOAD_MB * 1024 * 1024;
const TABLE_SEARCH_DEBOUNCE_MS = 180;

function formatValue(value: Row[string]) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function hasExpandableContent(row: Row) {
  return Object.values(row).some((value) => {
    const text = formatValue(value);
    return text.length > 120 || text.includes("\n") || text.includes("#(lf)");
  });
}

function numberValue(value: Row[string]) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function validateJsonFile(file: File): string | null {
  const isJsonName = file.name.toLowerCase().endsWith(".json");
  const isJsonType = !file.type || file.type === "application/json";
  if (!isJsonName || !isJsonType) {
    return "Selecione um arquivo .json exportado pelo LeitorBI ou Tabular Editor.";
  }
  if (file.size > MAX_JSON_UPLOAD_BYTES) {
    return `Arquivo muito grande. O limite para envio é ${MAX_JSON_UPLOAD_MB} MB.`;
  }
  return null;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function DataTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, TABLE_SEARCH_DEBOUNCE_MS);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnOptionSearches, setColumnOptionSearches] = useState<Record<string, string>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterMenuPosition, setFilterMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const columns = useMemo(() => (rows[0] ? Object.keys(rows[0]) : []), [rows]);
  const rowSearchText = useMemo(
    () => rows.map((row) => Object.values(row).map(formatValue).join("\n").toLowerCase()),
    [rows],
  );
  const openColumnUniqueValues = useMemo(() => {
    if (!openFilterColumn) return [];

    const values = new Set<string>();
    rows.forEach((row) => {
      values.add(formatValue(row[openFilterColumn]));
    });
    return Array.from(values).sort((first, second) => first.localeCompare(second));
  }, [openFilterColumn, rows]);
  const visibleRows = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    const activeFilters = Object.entries(columnFilters)
      .map(([column, values]) => [column, values.map((value) => value.toLowerCase())] as const)
      .filter(([, values]) => values.length);

    return rows.filter((row, index) => {
      const matchesGlobal = !normalized || rowSearchText[index]?.includes(normalized);
      const matchesColumns = activeFilters.every(([column, values]) =>
        values.includes(formatValue(row[column]).toLowerCase()),
      );
      return matchesGlobal && matchesColumns;
    });
  }, [columnFilters, debouncedQuery, rowSearchText, rows]);
  const activeColumnFilterCount = Object.values(columnFilters).reduce((total, values) => total + values.length, 0);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, visibleRows.length);
  const pageRows = visibleRows.slice(startIndex, endIndex);
  const hasExpandableRows = useMemo(() => visibleRows.some(hasExpandableContent), [visibleRows]);

  useEffect(() => {
    setPage(1);
    setExpandedRows(new Set());
  }, [columnFilters, debouncedQuery, rows]);

  useEffect(() => {
    setColumnFilters({});
    setColumnOptionSearches({});
    setOpenFilterColumn(null);
    setFilterMenuPosition(null);
  }, [rows]);

  function toggleRow(index: number) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleColumnFilterValue(column: string, value: string) {
    setColumnFilters((current) => {
      const selectedValues = current[column] ?? [];
      const nextValues = selectedValues.includes(value)
        ? selectedValues.filter((selectedValue) => selectedValue !== value)
        : [...selectedValues, value];
      const next = { ...current };
      if (nextValues.length) {
        next[column] = nextValues;
      } else {
        delete next[column];
      }
      return next;
    });
  }

  function updateColumnOptionSearch(column: string, value: string) {
    setColumnOptionSearches((current) => ({
      ...current,
      [column]: value,
    }));
  }

  function clearColumnFilter(column: string) {
    setColumnFilters((current) => {
      const next = { ...current };
      delete next[column];
      return next;
    });
    setColumnOptionSearches((current) => {
      const next = { ...current };
      delete next[column];
      return next;
    });
    setOpenFilterColumn(null);
    setFilterMenuPosition(null);
  }

  function clearAllColumnFilters() {
    setColumnFilters({});
    setColumnOptionSearches({});
    setOpenFilterColumn(null);
    setFilterMenuPosition(null);
  }

  function toggleColumnFilterMenu(column: string, target: HTMLButtonElement) {
    if (openFilterColumn === column) {
      setOpenFilterColumn(null);
      setFilterMenuPosition(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    setOpenFilterColumn(column);
    setFilterMenuPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
      top: rect.bottom + 8,
    });
  }

  if (!rows.length) {
    return (
      <section className="data-shell empty-data">
        <strong>Sem dados para exibir.</strong>
        <span>Carregue um export com informações nessa categoria ou revise os filtros aplicados.</span>
      </section>
    );
  }

  return (
    <section className="data-shell">
      <div className="table-toolbar">
        <div>
          <strong>{visibleRows.length}</strong>
          <span> registros</span>
          {visibleRows.length > PAGE_SIZE ? (
            <small>
              Exibindo {startIndex + 1}-{endIndex}
            </small>
          ) : null}
        </div>
        <label className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar em tudo" />
        </label>
        {activeColumnFilterCount ? (
          <button className="clear-filters-button" type="button" onClick={clearAllColumnFilters}>
            <X size={15} />
            Limpar filtros ({activeColumnFilterCount})
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {hasExpandableRows ? <th className="row-action-header">Detalhes</th> : null}
              {columns.map((column) => {
                const selectedFilterValues = columnFilters[column] ?? [];
                const optionSearchValue = columnOptionSearches[column] ?? "";
                const isOpen = openFilterColumn === column;
                const hasFilter = selectedFilterValues.length > 0;
                const normalizedOptionSearch = optionSearchValue.trim().toLowerCase();
                const uniqueValues = (isOpen ? openColumnUniqueValues : []).filter(
                  (value) => !normalizedOptionSearch || value.toLowerCase().includes(normalizedOptionSearch),
                );
                const visibleUniqueValues = uniqueValues.slice(0, UNIQUE_FILTER_LIMIT);
                return (
                  <th className={isOpen ? "filter-open" : ""} key={column}>
                    <div className="column-header">
                      <span>{column}</span>
                      <button
                        className={hasFilter ? "column-filter-button active" : "column-filter-button"}
                        type="button"
                        title={`Filtrar coluna ${column}`}
                        aria-label={`Filtrar coluna ${column}`}
                        onClick={(event) => toggleColumnFilterMenu(column, event.currentTarget)}
                      >
                        <Filter size={14} />
                      </button>
                      {isOpen ? (
                        <div
                          className="column-filter-menu"
                          style={
                            filterMenuPosition
                              ? { left: filterMenuPosition.left, top: filterMenuPosition.top }
                              : undefined
                          }
                        >
                          <label>
                            <span>Buscar nas opções</span>
                            <input
                              autoFocus
                              value={optionSearchValue}
                              onChange={(event) => updateColumnOptionSearch(column, event.target.value)}
                              placeholder={`Buscar ${column}`}
                            />
                          </label>
                          {hasFilter ? (
                            <p className="column-filter-current">
                              {selectedFilterValues.length} valor(es) selecionado(s)
                            </p>
                          ) : null}
                          <div className="column-value-panel">
                            <span>Valores únicos</span>
                            <div className="column-value-list">
                              {visibleUniqueValues.length ? (
                                visibleUniqueValues.map((value) => (
                                  <label
                                    className={selectedFilterValues.includes(value) ? "active" : ""}
                                    key={value}
                                    title={value}
                                  >
                                    <input
                                      checked={selectedFilterValues.includes(value)}
                                      type="checkbox"
                                      onChange={() => toggleColumnFilterValue(column, value)}
                                    />
                                    <span>{value}</span>
                                  </label>
                                ))
                              ) : (
                                <p>Nenhum valor encontrado.</p>
                              )}
                            </div>
                            {uniqueValues.length > UNIQUE_FILTER_LIMIT ? (
                              <small>Mostrando {UNIQUE_FILTER_LIMIT} de {uniqueValues.length} valores.</small>
                            ) : null}
                          </div>
                          <div className="column-filter-actions">
                            <button type="button" onClick={() => clearColumnFilter(column)} disabled={!hasFilter}>
                              Limpar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenFilterColumn(null);
                                setFilterMenuPosition(null);
                              }}
                            >
                              Fechar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => {
              const rowIndex = startIndex + index;
              const isExpandable = hasExpandableContent(row);
              const isExpanded = expandedRows.has(rowIndex);
              return (
                <Fragment key={`row-group-${rowIndex}`}>
                  <tr key={`row-${rowIndex}`}>
                    {hasExpandableRows ? (
                      <td className="row-action-cell">
                        {isExpandable ? (
                          <button
                            className="icon-action"
                            type="button"
                            title={isExpanded ? "Recolher linha" : "Expandir linha"}
                            aria-label={isExpanded ? "Recolher linha" : "Expandir linha"}
                            onClick={() => toggleRow(rowIndex)}
                          >
                            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column}>{formatValue(row[column])}</td>
                    ))}
                  </tr>
                  {isExpanded ? (
                    <tr className="expanded-row" key={`expanded-${rowIndex}`}>
                      <td colSpan={columns.length + (hasExpandableRows ? 1 : 0)}>
                        <div className="expanded-content">
                          {columns.map((column) => (
                            <section key={column}>
                              <span>{column}</span>
                              <pre>{formatValue(row[column])}</pre>
                            </section>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {visibleRows.length > PAGE_SIZE ? (
        <div className="pagination-bar">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div>
            <button
              type="button"
              className="pagination-button"
              disabled={currentPage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>
            <button
              type="button"
              className="pagination-button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Próxima
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CompareFileInput({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File) => void;
}) {
  return (
    <label className="compare-file">
      <FileJson size={28} />
      <span>{label}</span>
      <strong>{file ? file.name : "Selecionar JSON"}</strong>
      <input
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onChange(selected);
        }}
      />
    </label>
  );
}

function countCompareChanges(result: CompareResult) {
  return {
    added:
      compareItems(result.tabelas.adicionadas).length +
      compareItems(result.colunas.adicionadas).length +
      compareItems(result.medidas.adicionadas).length +
      compareItems(result.relacionamentos.adicionados).length,
    removed:
      compareItems(result.tabelas.removidas).length +
      compareItems(result.colunas.removidas).length +
      compareItems(result.medidas.removidas).length +
      compareItems(result.relacionamentos.removidos).length,
    changed:
      compareItems(result.tabelas.modificadas).length +
      compareItems(result.colunas.modificadas).length +
      compareItems(result.medidas.modificadas).length +
      compareItems(result.relacionamentos.modificados).length,
  };
}

function compareItems<T>(items: T[] | null | undefined) {
  return Array.isArray(items) ? items : [];
}

function compareEntries(items: unknown): CompareEntry[] {
  return Array.isArray(items) ? items.filter((item): item is CompareEntry => typeof item === "object" && item !== null) : [];
}

function compareStrings(items: unknown): string[] {
  return Array.isArray(items) ? items.map((item) => String(item)) : [];
}

function compareText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeCompareResult(result: CompareResult | null | undefined): CompareResult | null {
  if (!result) return null;

  const raw = result as unknown as Record<string, any>;
  const tabelas = raw.tabelas ?? {};
  const colunas = raw.colunas ?? {};
  const medidas = raw.medidas ?? {};
  const relacionamentos = raw.relacionamentos ?? {};

  return {
    dashboard_base: compareText(raw.dashboard_base, "BASE"),
    dashboard_novo: compareText(raw.dashboard_novo, "NOVO"),
    tabelas: {
      adicionadas: compareStrings(tabelas.adicionadas),
      removidas: compareStrings(tabelas.removidas),
      modificadas: compareEntries(tabelas.modificadas),
    },
    colunas: {
      adicionadas: compareEntries(colunas.adicionadas),
      removidas: compareEntries(colunas.removidas),
      modificadas: compareEntries(colunas.modificadas),
    },
    medidas: {
      adicionadas: compareEntries(medidas.adicionadas),
      removidas: compareEntries(medidas.removidas),
      modificadas: compareEntries(medidas.modificadas),
    },
    relacionamentos: {
      adicionados: compareStrings(relacionamentos.adicionados),
      removidos: compareStrings(relacionamentos.removidos),
      modificados: compareEntries(relacionamentos.modificados),
    },
  };
}

function entryTitle(entry: CompareEntry, fallback = "Item") {
  return String(entry.nome ?? entry.medida ?? entry.coluna ?? entry.relacionamento ?? entry.tabela ?? fallback);
}

function compareValueToText(value: CompareEntry[string]) {
  if (Array.isArray(value)) return value.length ? value.join("\n") : "-";
  return formatValue(value);
}

function compareDetails(item: string | CompareEntry) {
  if (typeof item === "string") {
    return [{ key: "valor", label: "Valor", value: item }];
  }

  return Object.entries(item).map(([key, value]) => ({
    key,
    label: key.replace(/_/g, " "),
    value: compareValueToText(value),
  }));
}

function ChangeList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "added" | "removed" | "changed";
  items: Array<string | CompareEntry>;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedItems(new Set());
  }, [items]);

  function toggleItem(key: string) {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <article className="change-list">
      <header>
        <span className={`badge ${tone}`}>{items.length}</span>
        <h3>{title}</h3>
      </header>
      {items.length === 0 ? (
        <p className="empty-change">Sem alterações nesta categoria.</p>
      ) : (
        <ul>
          {items.slice(0, 80).map((item, index) => {
            const titleText = typeof item === "string" ? item : entryTitle(item);
            const itemKey = `${title}-${titleText}-${index}`;
            const isExpanded = expandedItems.has(itemKey);
            const details = compareDetails(item);
            const hasDaxChange = typeof item !== "string" && ("antes" in item || "depois" in item);

            return (
              <li className="change-item" key={itemKey}>
                <div className="change-item-main">
                  <strong>{titleText}</strong>
                  <button
                    className="icon-action"
                    type="button"
                    title={isExpanded ? "Recolher detalhe" : "Expandir detalhe"}
                    aria-label={isExpanded ? "Recolher detalhe" : "Expandir detalhe"}
                    onClick={() => toggleItem(itemKey)}
                  >
                    {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                </div>
                {isExpanded ? (
                  <div className={hasDaxChange ? "change-detail dax-detail" : "change-detail"}>
                    {hasDaxChange ? (
                      <>
                        <section>
                          <span>Antes</span>
                          <pre>{compareValueToText(typeof item === "string" ? "" : item.antes)}</pre>
                        </section>
                        <section>
                          <span>Depois</span>
                          <pre>{compareValueToText(typeof item === "string" ? "" : item.depois)}</pre>
                        </section>
                      </>
                    ) : (
                      details.map((detail) => (
                        <section key={detail.key}>
                          <span>{detail.label}</span>
                          <pre>{detail.value}</pre>
                        </section>
                      ))
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 80 ? <p className="hint">Mostrando os primeiros 80 itens.</p> : null}
    </article>
  );
}

class CompareErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Prevent a malformed comparison payload from blanking the entire app.
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error compare-runtime-error">
          <strong>Não foi possível renderizar a comparação.</strong>
          <span>Limpe o resultado e tente comparar os arquivos novamente.</span>
          <button className="ghost-action" type="button" onClick={this.handleReset}>
            Limpar comparação
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function CompareView({
  baseFile,
  newFile,
  result,
  loading,
  error,
  onBaseFileChange,
  onNewFileChange,
  onResultChange,
  onLoadingChange,
  onErrorChange,
  onClear,
}: {
  baseFile: File | null;
  newFile: File | null;
  result: CompareResult | null;
  loading: boolean;
  error: string;
  onBaseFileChange: (file: File | null) => void;
  onNewFileChange: (file: File | null) => void;
  onResultChange: (result: CompareResult | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onErrorChange: (error: string) => void;
  onClear: () => void;
}) {
  const hasComparisonState = Boolean(baseFile || newFile || result || error);
  const normalizedResult = normalizeCompareResult(result);

  function handleBaseFileChange(file: File) {
    onBaseFileChange(file);
    onResultChange(null);
    onErrorChange("");
  }

  function handleNewFileChange(file: File) {
    onNewFileChange(file);
    onResultChange(null);
    onErrorChange("");
  }

  async function handleCompare() {
    if (!baseFile || !newFile) {
      onErrorChange("Selecione os dois JSONs para comparar.");
      return;
    }

    onLoadingChange(true);
    onErrorChange("");
    try {
      const comparison = await compareModels(baseFile, newFile);
      onResultChange(normalizeCompareResult(comparison));
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : "Erro inesperado ao comparar.");
    } finally {
      onLoadingChange(false);
    }
  }

  const totals = normalizedResult ? countCompareChanges(normalizedResult) : { added: 0, removed: 0, changed: 0 };

  return (
    <div className="compare-page">
      <header className="page-header">
        <GitCompareArrows size={22} />
        <div>
          <h2>Comparar modelos</h2>
          <p>Escolha dois exports JSON para descobrir o que mudou entre versões.</p>
        </div>
      </header>

      <section className="compare-picker">
        <CompareFileInput label="Modelo base" file={baseFile} onChange={handleBaseFileChange} />
        <div className="compare-plus">
          <Plus size={20} />
        </div>
        <CompareFileInput label="Modelo novo" file={newFile} onChange={handleNewFileChange} />
        <div className="compare-actions">
          <button className="primary-action" disabled={loading || !baseFile || !newFile} onClick={handleCompare}>
            {loading ? "Comparando..." : "Comparar modelos"}
          </button>
          {hasComparisonState ? (
            <button className="ghost-action" type="button" onClick={onClear} disabled={loading}>
              <RotateCcw size={18} />
              Desfazer comparação
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      {normalizedResult ? (
        <>
          <section className="compare-hero">
            <div>
              <span className="eyebrow">Resultado da comparação</span>
              <h1>{normalizedResult.dashboard_base} para {normalizedResult.dashboard_novo}</h1>
            </div>
            <div className="compare-stats">
              <div>
                <span>Adicionados</span>
                <strong>{totals.added}</strong>
              </div>
              <div>
                <span>Removidos</span>
                <strong>{totals.removed}</strong>
              </div>
              <div>
                <span>Alterados</span>
                <strong>{totals.changed}</strong>
              </div>
            </div>
          </section>

          <section className="change-grid">
            <ChangeList title="Tabelas adicionadas" tone="added" items={normalizedResult.tabelas.adicionadas} />
            <ChangeList title="Tabelas removidas" tone="removed" items={normalizedResult.tabelas.removidas} />
            <ChangeList title="Tabelas modificadas" tone="changed" items={normalizedResult.tabelas.modificadas} />
            <ChangeList title="Colunas adicionadas" tone="added" items={normalizedResult.colunas.adicionadas} />
            <ChangeList title="Colunas removidas" tone="removed" items={normalizedResult.colunas.removidas} />
            <ChangeList title="Colunas modificadas" tone="changed" items={normalizedResult.colunas.modificadas} />
            <ChangeList title="Medidas adicionadas" tone="added" items={normalizedResult.medidas.adicionadas} />
            <ChangeList title="Medidas removidas" tone="removed" items={normalizedResult.medidas.removidas} />
            <ChangeList title="Medidas modificadas" tone="changed" items={normalizedResult.medidas.modificadas} />
            <ChangeList
              title="Relacionamentos adicionados"
              tone="added"
              items={normalizedResult.relacionamentos.adicionados}
            />
            <ChangeList
              title="Relacionamentos removidos"
              tone="removed"
              items={normalizedResult.relacionamentos.removidos}
            />
            <ChangeList
              title="Relacionamentos modificados"
              tone="changed"
              items={normalizedResult.relacionamentos.modificados}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function TutorialView() {
  const steps = [
    {
      label: "PASSO 1",
      title: "Baixe e instale o Tabular Editor",
      detail: (
        <>
          Baixe e instale o{" "}
          <a href="https://github.com/TabularEditor/TabularEditor/releases/latest" target="_blank" rel="noreferrer">
            <strong>Tabular Editor</strong>
          </a>{" "}
          antes de iniciar a extração.
        </>
      ),
    },
    {
      label: "PASSO 2",
      title: "Abra o Power BI Desktop",
      detail: "Abra o arquivo .pbix e aguarde o modelo carregar.",
    },
    {
      label: "PASSO 3",
      title: "Abra o Tabular Editor",
      detail: "Acesse Ferramentas externas e conecte o Tabular Editor ao modelo.",
    },
    {
      label: "PASSO 4",
      title: "Execute o script de exportação",
      detail: "Execute o script",
      script: "PBIXExportModel",
      suffix: "para gerar o JSON de análise.",
    },
    {
      label: "PASSO 5",
      title: "Abra o JSON no LeitorBI",
      detail: "Clique em Carregar JSON e selecione o arquivo salvo na pasta Downloads.",
    },
    {
      label: "PASSO 6",
      title: "Analise e exporte",
      detail: "Use filtros, detalhamentos e Exportar Excel para compartilhar a análise.",
    },
  ];

  const tips = [
    "O script destacado é o responsável por extrair o modelo em JSON para leitura no LeitorBI.",
    "Se o JSON não aparecer, confirme se o Power BI terminou de carregar o modelo antes de executar o script.",
    "Depois da extração, o fluxo continua pela aba Início com o botão de carregar JSON.",
  ];

  return (
    <div className="tutorial-page">
      <header className="page-header">
        <BookOpenCheck size={22} />
        <div>
          <h2>Tutorial</h2>
          <p>Como extrair o JSON do Power BI e abrir a análise no LeitorBI.</p>
        </div>
      </header>

      <section className="tutorial-hero">
        <div>
          <span className="eyebrow">Extração do modelo</span>
          <h1>Gere o JSON pelo Tabular Editor e continue a análise no LeitorBI.</h1>
          <p>
            O passo central é executar o script de exportação usado para transformar o modelo aberto no Power BI em um
            arquivo JSON.
          </p>
        </div>
        <ClipboardList size={64} />
      </section>

      <section className="tutorial-steps">
        {steps.map((step) => (
          <article className="tutorial-step" key={step.title}>
            <span>{step.label}</span>
            <div>
              <h3>{step.title}</h3>
              <p>
                {step.detail}
                {step.script ? (
                  <>
                    {" "}
                    <code>{step.script}</code>{" "}
                  </>
                ) : (
                  " "
                )}
                {step.suffix ?? ""}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="tutorial-notes">
        <h3>Dicas de uso</h3>
        <ul>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DemoPage({
  loading,
  error,
  onLogin,
  onRegister,
}: {
  loading: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
}) {
  const [showLogin, setShowLogin] = useState(false);
  const [demoReport, setDemoReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<Exclude<TabKey, "tutorial" | "compare" | "users">>("overview");
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState("");

  useEffect(() => {
    let active = true;

    analyzePublicDemoModel()
      .then((result) => {
        if (active) setDemoReport(result);
      })
      .catch((err) => {
        if (active) setDemoError(err instanceof Error ? err.message : "Erro inesperado ao carregar demonstracao.");
      })
      .finally(() => {
        if (active) setDemoLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const rowsByTab: Record<DataTabKey, Row[]> = {
    tables: demoReport?.tables ?? [],
    columns: demoReport?.columns ?? [],
    measures: demoReport?.measures ?? [],
    sources: demoReport?.sources ?? [],
    relationships: demoReport?.relationships ?? [],
  };

  const isDataTab = activeTab !== "overview";

  return (
    <main className="app-shell demo-shell">
      <aside className="sidebar">
        <a className="brand demo-brand-link" href={ROUTES.landing}>
          <Database size={24} />
          <span>LeitorBI</span>
        </a>
        <nav>
          {demoTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="compare-teaser">
          <ShieldCheck size={18} />
          <span>Demo publica em modo leitura, usando apenas dados de exemplo.</span>
        </div>
      </aside>

      <section className="content">
        <header className="workspace-topbar demo-topbar">
          <div>
            <span>Demonstracao publica</span>
            <strong>{demoReport ? demoReport.raw.dashboardName : "Carregando exemplo"}</strong>
          </div>
          <div className="landing-access">
            <button className="ghost-action" type="button" onClick={() => setShowLogin((current) => !current)}>
              <ShieldCheck size={18} />
              Fazer login
            </button>
            {showLogin ? (
              <LoginPopover loading={loading} error={error} onLogin={onLogin} onRegister={onRegister} />
            ) : null}
          </div>
        </header>

        <div className="demo-lock-note">
          <ShieldCheck size={18} />
          <span>Previa somente leitura. Para carregar JSON, exportar Excel ou comparar modelos, faca login no app.</span>
          <a className="ghost-action" href={ROUTES.landing}>
            Voltar ao inicio
          </a>
        </div>

        {demoLoading ? <div className="status">Carregando demonstracao...</div> : null}
        {demoError ? <div className="error">{demoError}</div> : null}
        {demoReport && activeTab === "overview" ? <Overview report={demoReport} isDemo readOnly /> : null}
        {demoReport && isDataTab ? (
          <>
            <header className="page-header">
              <Table2 size={22} />
              <div>
                <h2>{demoTabs.find((tab) => tab.key === activeTab)?.label}</h2>
                <p>{demoReport.raw.dashboardName}</p>
              </div>
            </header>
            <DataTable rows={rowsByTab[activeTab as DataTabKey]} />
          </>
        ) : null}
      </section>
    </main>
  );
}

function UsersAdminView({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const created = await createUser(name, email, password, isAdmin);
      setUsers((current) => [created, ...current]);
      setName("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      setSuccess("Usuario criado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao criar usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUser(userId: number, changes: Partial<Pick<ManagedUser, "is_admin" | "disabled">>) {
    setError("");
    setSuccess("");
    try {
      const updated = await updateUser(userId, changes);
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setSuccess("Usuario atualizado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao atualizar usuario.");
    }
  }

  async function handleDeleteUser(managedUser: ManagedUser) {
    if (managedUser.email === currentUser.email) {
      setError("Voce nao pode remover seu proprio usuario.");
      return;
    }

    const confirmed = window.confirm(`Remover o usuario ${managedUser.email}? Esta acao nao pode ser desfeita.`);
    if (!confirmed) return;

    setDeletingUserId(managedUser.id);
    setError("");
    setSuccess("");
    try {
      await deleteUser(managedUser.id);
      setUsers((current) => current.filter((user) => user.id !== managedUser.id));
      setSuccess("Usuario removido com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao remover usuario.");
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <div className="users-page">
      <header className="page-header">
        <Users size={22} />
        <div>
          <h2>Usuários</h2>
          <p>Gerencie quem pode acessar a área autenticada do LeitorBI.</p>
        </div>
      </header>

      <section className="users-create-panel">
        <div>
          <h3>Novo usuário</h3>
          <p>Crie acessos individuais. A senha inicial deve ser compartilhada por um canal seguro.</p>
        </div>
        <form className="users-create-form" onSubmit={handleCreateUser}>
          <label>
            <span>Nome</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do usuario"
              required
            />
          </label>
          <label>
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="analista@empresa.com"
              required
            />
          </label>
          <label>
            <span>Senha inicial</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={isAdmin} onChange={(event) => setIsAdmin(event.target.checked)} />
            <span>Administrador</span>
          </label>
          <button className="primary-action" type="submit" disabled={saving}>
            <UserPlus size={18} />
            {saving ? "Criando..." : "Criar usuário"}
          </button>
        </form>
      </section>

      {error ? <div className="error">{error}</div> : null}
      {success ? <div className="status">{success}</div> : null}

      <section className="users-list-panel">
        <div className="table-toolbar">
          <div>
            <strong>{users.length}</strong>
            <span> usuários</span>
          </div>
          <button className="clear-filters-button" type="button" onClick={loadUsers} disabled={loading}>
            <RotateCcw size={15} />
            Atualizar
          </button>
        </div>

        {loading ? <div className="status">Carregando usuários...</div> : null}
        {!loading && !users.length ? (
          <div className="empty-data">
            <strong>Nenhum usuário encontrado.</strong>
            <span>Crie o primeiro usuário para liberar acesso ao app.</span>
          </div>
        ) : null}
        {!loading && users.length ? (
          <div className="users-list">
            {users.map((managedUser) => {
              const isSelf = managedUser.email === currentUser.email;
              return (
                <article className={managedUser.disabled ? "user-row disabled" : "user-row"} key={managedUser.id}>
                  <div>
                    <strong>{managedUser.name || managedUser.email}</strong>
                    {managedUser.name ? <small>{managedUser.email}</small> : null}
                    <span>
                      {managedUser.is_admin ? "Administrador" : "Usuário"} ·{" "}
                      {managedUser.disabled ? "Desativado" : "Ativo"}
                      {isSelf ? " · Você" : ""}
                    </span>
                  </div>
                  <div className="user-row-actions">
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={isSelf}
                      onClick={() => handleUpdateUser(managedUser.id, { is_admin: !managedUser.is_admin })}
                    >
                      {managedUser.is_admin ? "Remover admin" : "Tornar admin"}
                    </button>
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={isSelf}
                      onClick={() => handleUpdateUser(managedUser.id, { disabled: !managedUser.disabled })}
                    >
                      {managedUser.disabled ? "Reativar" : "Desativar"}
                    </button>
                    <button
                      className="danger-action"
                      type="button"
                      title={isSelf ? "Voce nao pode remover seu proprio usuario" : "Remover usuario"}
                      aria-label={`Remover ${managedUser.email}`}
                      disabled={isSelf || deletingUserId === managedUser.id}
                      onClick={() => handleDeleteUser(managedUser)}
                    >
                      <Trash2 size={16} />
                      {deletingUserId === managedUser.id ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function UploadPanel({
  onAnalyze,
  onLoadDemo,
  loadingDemo,
}: {
  onAnalyze: (file: File) => void;
  onLoadDemo: () => void;
  loadingDemo: boolean;
}) {
  return (
    <section className="upload-panel">
      <div className="upload-copy">
        <span className="eyebrow">LeitorBI Web</span>
        <h1>Transforme exports Power BI em uma leitura clara para auditoria e demo.</h1>
        <p>
          Abra tabelas, medidas, fontes, relações e mudanças do modelo em uma interface leve para revisar com o time.
        </p>
        <div className="hero-actions">
          <button className="primary-action" type="button" onClick={onLoadDemo} disabled={loadingDemo}>
            <PlayCircle size={18} />
            {loadingDemo ? "Carregando..." : "Carregar exemplo"}
          </button>
          <span>Ou envie um JSON real exportado pelo LeitorBI.</span>
        </div>
        <div className="hero-proof">
          <div>
            <WandSparkles size={18} />
            <strong>Resumo executivo</strong>
            <span>KPIs do modelo prontos para apresentar.</span>
          </div>
          <div>
            <GitCompareArrows size={18} />
            <strong>Comparação visual</strong>
            <span>Mudanças agrupadas entre dois exports.</span>
          </div>
          <div>
            <Download size={18} />
            <strong>Entrega em Excel</strong>
            <span>Inventário completo para compartilhar.</span>
          </div>
        </div>
      </div>

      <label className="drop-zone">
        <FileJson size={42} />
        <strong>Selecionar JSON do modelo</strong>
        <span>O arquivo fica apenas no processamento da API local.</span>
        <input
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onAnalyze(file);
          }}
        />
      </label>
    </section>
  );
}

function HomeEmptyState({
  onOpenFilePicker,
  disabled,
  selectedFileLabel,
}: {
  onOpenFilePicker: () => void;
  disabled: boolean;
  selectedFileLabel: string;
}) {
  return (
    <div className="home-empty-page">
      <header className="page-header">
        <Database size={22} />
        <div>
          <h2>Inicio</h2>
          <p>Carregue um arquivo JSON exportado do Power BI para iniciar o levantamento.</p>
        </div>
      </header>

      <section className="empty-workspace">
        <h1>Nenhum arquivo carregado</h1>
        <p>
          Carregue um arquivo JSON exportado do Power BI para iniciar a analise. O LeitorBI ira levantar tabelas
          utilizadas no modelo, colunas totais, medidas, fontes de dados e relacionamentos, ignorando tabelas tecnicas
          de data automatica.
        </p>

        <button
          className="empty-drop-hint"
          type="button"
          onClick={onOpenFilePicker}
          disabled={disabled}
          aria-label="Carregar arquivo JSON exportado do Power BI"
        >
          <FileJson size={34} />
          <strong>{disabled ? "Analisando arquivo..." : "Selecionar JSON do modelo"}</strong>
          <span>{selectedFileLabel || "Aceita arquivos .json de ate 10 MB."}</span>
        </button>

        <div className="upload-rules">
          <span>Formato aceito: `.json` em UTF-8</span>
          <span>Limite: {MAX_JSON_UPLOAD_MB} MB por arquivo</span>
          <span>Dados reais exigem login e ficam restritos ao processamento da API.</span>
        </div>
      </section>
    </div>
  );
}

function Overview({
  report,
  onAnalyze,
  onClose,
  onExport,
  loading,
  exporting,
  isDemo,
  readOnly = false,
}: {
  report: Report;
  onAnalyze?: (file: File) => void;
  onClose?: () => void;
  onExport?: () => void;
  loading?: boolean;
  exporting?: boolean;
  isDemo: boolean;
  readOnly?: boolean;
}) {
  const summary = report.summary;
  const tables = numberValue(summary["Tabelas totais"]);
  const totalColumns = numberValue(summary["Colunas totais"]);
  const usedColumns = numberValue(summary["Colunas utilizadas"]);
  const measures = numberValue(summary["Medidas"]);
  const sources = numberValue(summary["Fontes de dados"]);
  const relationships = numberValue(summary["Relacionamentos"]);
  const inactiveRelationships = report.relationships.filter((row) => formatValue(row["Ativo"]) === "Não").length;
  const hiddenColumns = report.columns.filter((row) => formatValue(row["Oculto"]) === "Sim").length;
  const calculatedTables = report.tables.filter((row) => formatValue(row["Tipo"]).toLowerCase().includes("calculada")).length;
  const cards: Array<[string, Row[string], Row[string]]> = [
    ["Tabelas", tables, "Modelo visivel"],
    ["Colunas", totalColumns, `${usedColumns} visíveis`],
    ["Medidas", measures, "Cálculos DAX"],
    ["Fontes", sources, summary["Tipos de fontes"]],
    ["Relações", relationships, "Mapa sem tabelas técnicas"],
  ];
  const insightCards = [
    {
      icon: ShieldCheck,
      title: "Pronto para leitura",
      value: `${tables} tabelas e ${measures} medidas`,
      detail: "Inventário centralizado para revisar estrutura, fonte e DAX.",
      tone: "good",
    },
    {
      icon: AlertTriangle,
      title: "Pontos de atenção",
      value: pluralize(inactiveRelationships, "relação inativa", "relações inativas"),
      detail: `${pluralize(hiddenColumns, "coluna oculta", "colunas ocultas")} e ${pluralize(
        calculatedTables,
        "tabela calculada detectada",
        "tabelas calculadas detectadas",
      )}.`,
      tone: inactiveRelationships ? "warn" : "good",
    },
    {
      icon: Database,
      title: "Origem dos dados",
      value: formatValue(summary["Tipos de fontes"]),
      detail: "Tipos de conexão detectados pelas expressões M das partições.",
      tone: "info",
    },
  ];

  return (
    <div className="overview">
      <section className="model-hero">
        <div>
          <span className="eyebrow">{isDemo ? "Modelo de exemplo" : "Modelo carregado"}</span>
          <h1>{formatValue(summary["Dashboard"])}</h1>
          <p>
            {formatValue(summary["Modelo"])} | {formatValue(summary["Modo padrao"])} | {formatValue(summary["Data de exportacao"])}
          </p>
        </div>
        {!readOnly ? <div className="model-actions">
          <label className="secondary-action file-action">
            <FileJson size={18} />
            {loading ? "Analisando..." : "Trocar JSON"}
            <input
              type="file"
              accept=".json,application/json"
              disabled={loading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onAnalyze?.(file);
              }}
            />
          </label>
          <button className="secondary-action" type="button" onClick={onExport} disabled={exporting}>
            <Download size={18} />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </button>
          <button className="ghost-action" type="button" onClick={onClose}>
            <X size={18} />
            Fechar análise
          </button>
        </div> : null}
      </section>

      <section className="metric-grid">
        {cards.map(([label, value, detail]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{formatValue(value)}</strong>
            <small>{formatValue(detail)}</small>
          </article>
        ))}
      </section>

      <section className="insight-grid">
        {insightCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`insight-card ${card.tone}`} key={card.title}>
              <Icon size={22} />
              <div>
                <span>{card.title}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="summary-list">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{formatValue(value)}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentPath, setCurrentPath] = useState<AppRoute>(() => routeFromPath(window.location.pathname));
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pendingFileLabel, setPendingFileLabel] = useState("");
  const [error, setError] = useState("");
  const [compareBaseFile, setCompareBaseFile] = useState<File | null>(null);
  const [compareNewFile, setCompareNewFile] = useState<File | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((err) => {
        if (active) setLoginError(err instanceof Error ? err.message : "Erro ao verificar sessao.");
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(routeFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (checkingSession) {
      return;
    }

    if (user && currentPath !== ROUTES.app) {
      navigateTo(ROUTES.app, { replace: true });
      return;
    }

    if (!user && currentPath === ROUTES.app) {
      navigateTo(ROUTES.landing, { replace: true });
    }
  }, [checkingSession, currentPath, user]);

  function navigateTo(path: AppRoute, options: { replace?: boolean } = {}) {
    if (window.location.pathname !== path) {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method](null, "", path);
    }
    setCurrentPath(path);
  }

  function clearWorkspaceState() {
    setReport(null);
    setCurrentFile(null);
    setPendingFileLabel("");
    setError("");
    setActiveTab("overview");
    handleClearComparison();
  }

  async function handleLogin(email: string, password: string) {
    setLoginLoading(true);
    setLoginError("");
    try {
      const authenticatedUser = await loginUser(email, password);
      setUser(authenticatedUser);
      clearWorkspaceState();
      navigateTo(ROUTES.app);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "E-mail ou senha invalidos.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(name: string, email: string, password: string) {
    setLoginLoading(true);
    setLoginError("");
    try {
      await registerUser(name, email, password);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      setLoginError("");
      clearWorkspaceState();
      navigateTo(ROUTES.landing);
    }
  }

  function handleAuthenticatedError(err: unknown, fallback: string, onErrorChange = setError) {
    const message = err instanceof Error ? err.message : fallback;
    if (message.includes("Sessao expirada")) {
      setUser(null);
      setLoginError(message);
      clearWorkspaceState();
      navigateTo(ROUTES.landing, { replace: true });
      return;
    }
    onErrorChange(message);
  }

  async function handleAnalyze(file: File) {
    const validationError = validateJsonFile(file);
    if (validationError) {
      setError(validationError);
      setPendingFileLabel(`${file.name} (${formatFileSize(file.size)})`);
      return;
    }

    setLoading(true);
    setError("");
    setPendingFileLabel(`${file.name} (${formatFileSize(file.size)})`);
    try {
      const result = await analyzeModel(file);
      setReport(result);
      setCurrentFile(file);
      setActiveTab("overview");
    } catch (err) {
      handleAuthenticatedError(err, "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handleAnalyze(file);
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      if (!currentFile) {
        throw new Error("Carregue um JSON antes de exportar.");
      }
      const blob = await exportModelExcel(currentFile);
      const dashboardName = report?.raw.dashboardName || "leitorbi";
      downloadBlob(blob, `${dashboardName}_analise.xlsx`);
    } catch (err) {
      handleAuthenticatedError(err, "Erro inesperado ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  function handleCloseAnalysis() {
    setReport(null);
    setCurrentFile(null);
    setPendingFileLabel("");
    setError("");
    setActiveTab("overview");
  }

  function handleClearComparison() {
    setCompareBaseFile(null);
    setCompareNewFile(null);
    setCompareResult(null);
    setCompareLoading(false);
    setCompareError("");
  }

  const rowsByTab: Record<DataTabKey, Row[]> = {
    tables: report?.tables ?? [],
    columns: report?.columns ?? [],
    measures: report?.measures ?? [],
    sources: report?.sources ?? [],
    relationships: report?.relationships ?? [],
  };

  const visibleTabs = user?.is_admin ? [...tabs, ...adminTabs] : tabs;
  const isDataTab = !["overview", "tutorial", "compare", "users"].includes(activeTab);
  const activeRows = isDataTab ? rowsByTab[activeTab as DataTabKey] : [];

  if (checkingSession) {
    return (
      <main className="login-shell">
        <section className="login-panel compact">
          <div className="status">Verificando sessao...</div>
        </section>
      </main>
    );
  }

  if (!user) {
    if (currentPath === ROUTES.demo) {
      return <DemoPage loading={loginLoading} error={loginError} onLogin={handleLogin} onRegister={handleRegister} />;
    }

    return <LandingPage loading={loginLoading} error={loginError} onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Database size={24} />
          <span>LeitorBI</span>
        </div>
        <nav>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              disabled={!report && !["overview", "tutorial", "compare", "users"].includes(tab.key)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="user-panel">
          <div>
            <span>Logado como</span>
            <strong>{user.name || user.email}</strong>
          </div>
          <button type="button" onClick={handleLogout} title="Sair" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
        <div className="compare-teaser">
          <GitCompareArrows size={18} />
          <span>Compare dois exports JSON lado a lado.</span>
        </div>
      </aside>

      <section className="content">
        <input
          ref={fileInputRef}
          className="workspace-file-input"
          type="file"
          accept=".json,application/json"
          onChange={handleFileInputChange}
        />
        <header className="workspace-topbar">
          <div>
            <span>Workspace</span>
            <strong>{report ? report.raw.dashboardName : pendingFileLabel || "Nenhum modelo carregado"}</strong>
          </div>
          {!report ? (
            <button className="secondary-action" type="button" onClick={openFilePicker} disabled={loading}>
              <FileJson size={18} />
              {loading ? "Analisando..." : "Carregar JSON"}
            </button>
          ) : null}
        </header>
        {!report && activeTab === "overview" ? (
          <HomeEmptyState
            onOpenFilePicker={openFilePicker}
            disabled={loading}
            selectedFileLabel={pendingFileLabel}
          />
        ) : null}
        {loading ? <div className="status">Analisando modelo...</div> : null}
        {error ? <div className="error">{error}</div> : null}
        {report && activeTab === "overview" ? (
          <Overview
            report={report}
            onAnalyze={handleAnalyze}
            onClose={handleCloseAnalysis}
            onExport={handleExport}
            loading={loading}
            exporting={exporting}
            isDemo={false}
          />
        ) : null}
        {activeTab === "tutorial" ? <TutorialView /> : null}
        {activeTab === "compare" ? (
          <CompareErrorBoundary onReset={handleClearComparison}>
            <CompareView
              baseFile={compareBaseFile}
              newFile={compareNewFile}
              result={compareResult}
              loading={compareLoading}
              error={compareError}
              onBaseFileChange={setCompareBaseFile}
              onNewFileChange={setCompareNewFile}
              onResultChange={setCompareResult}
              onLoadingChange={setCompareLoading}
              onErrorChange={setCompareError}
              onClear={handleClearComparison}
            />
          </CompareErrorBoundary>
        ) : null}
        {activeTab === "users" && user.is_admin ? <UsersAdminView currentUser={user} /> : null}
        {report && isDataTab ? (
          <>
            <header className="page-header">
              <Table2 size={22} />
              <div>
                <h2>{visibleTabs.find((tab) => tab.key === activeTab)?.label}</h2>
                <p>{report.raw.dashboardName}</p>
              </div>
            </header>
            <DataTable rows={activeRows} />
          </>
        ) : null}
      </section>
    </main>
  );
}
