import { ChevronDown, GitCompareArrows, Maximize2, Minimize2, Plus, RotateCcw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { compareModels } from "../api";
import { CompareFileInput } from "./CompareFileInput";
import type { CompareEntry, CompareResult, Row } from "../types";

function formatValue(value: Row[string]) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
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

function compareEntries<T extends CompareEntry>(items: unknown): T[] {
  return Array.isArray(items) ? items.filter((item): item is T => typeof item === "object" && item !== null) : [];
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

type ChangeTone = "added" | "removed" | "changed";

function getMeasureDaxExpression(item: CompareEntry) {
  const candidateKeys = [
    "expressao_dax",
    "expressão_dax",
    "Expressao DAX",
    "Expressão DAX",
    "expression",
    "dax",
    "after",
    "new",
    "current",
    "before",
    "old",
    "previous",
  ];

  for (const key of candidateKeys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return "Expressão DAX não disponível.";
}

function compareExpansionSections(item: string | CompareEntry, title: string, tone: ChangeTone) {
  const isMeasureCategory = title.toLowerCase().startsWith("medidas ");

  if (typeof item !== "string" && isMeasureCategory && tone !== "changed") {
    return [
      {
        key: "measure-dax",
        label: "Medida DAX",
        value: getMeasureDaxExpression(item),
        variant: "single-dax",
      },
    ];
  }

  if (typeof item !== "string" && ("antes" in item || "depois" in item)) {
    return [
      { key: "before", label: "Antes", value: compareValueToText(item.antes), variant: "dax" },
      { key: "after", label: "Depois", value: compareValueToText(item.depois), variant: "dax" },
    ];
  }

  return compareDetails(item).map((detail) => ({ ...detail, variant: "default" }));
}

function ChangeList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: ChangeTone;
  items: Array<string | CompareEntry>;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPosition, setFilterPosition] = useState<{ left: number; top: number } | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [optionQuery, setOptionQuery] = useState("");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    setExpandedItems(new Set());
  }, [items]);

  useEffect(() => {
    if (!filterOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!filterButtonRef.current?.contains(event.target as Node) && !filterMenuRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
        filterButtonRef.current?.focus();
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFilterOpen(false);
        filterButtonRef.current?.focus();
      }
    }
    function closeOnViewportChange() {
      setFilterOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [filterOpen]);

  const options = Array.from(new Set(items.map((item) => typeof item === "string" ? item : entryTitle(item)))).sort();
  const visibleOptions = options.filter((option) => option.toLowerCase().includes(optionQuery.trim().toLowerCase()));
  const visibleItems = items.filter((item) => {
    const titleText = typeof item === "string" ? item : entryTitle(item);
    if (selectedTitles.length && !selectedTitles.includes(titleText)) return false;
    if (!normalizedQuery) return true;
    const text = typeof item === "string" ? item : Object.values(item).flat().join(" ");
    return text.toLowerCase().includes(normalizedQuery);
  });

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

  function toggleFilter(target: HTMLButtonElement) {
    if (filterOpen) {
      setFilterOpen(false);
      setFilterPosition(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const margin = 12;
    const menuWidth = 288;
    const estimatedMenuHeight = 360;
    const left = Math.max(margin, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin)) + window.scrollX;
    const top = window.innerHeight - rect.bottom >= estimatedMenuHeight
      ? rect.bottom + window.scrollY + 8
      : Math.max(margin, rect.top + window.scrollY - estimatedMenuHeight - 8);
    setFilterPosition({ left, top });
    setFilterOpen(true);
  }

  return (
    <article className="change-list">
      <header>
        <span className={`badge ${tone}`}>{items.length}</span>
        <h3>{title}</h3>
      </header>
      <div className="table-toolbar compare-category-toolbar">
        <label className="search-box"><Search size={16} /><input aria-label={`Buscar em ${title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nesta categoria" /></label>
        <button ref={filterButtonRef} className={filterOpen ? "column-filter-button active" : "column-filter-button"} type="button" aria-label={`Filtrar ${title}`} aria-expanded={filterOpen} onClick={(event) => toggleFilter(event.currentTarget)}><ChevronDown size={16} /></button>
        {filterOpen ? createPortal(<div ref={filterMenuRef} className="column-filter-menu" style={{ ...filterPosition, position: "absolute" }}>
          <label><span>Buscar nas opções</span><input autoFocus value={optionQuery} onChange={(event) => setOptionQuery(event.target.value)} placeholder={`Buscar ${title}`} /></label>
          <div className="column-value-panel"><span>Valores únicos</span><div className="column-value-list">{visibleOptions.map((option) => <label className={selectedTitles.includes(option) ? "active" : ""} key={option}><input type="checkbox" checked={selectedTitles.includes(option)} onChange={() => setSelectedTitles((current) => current.includes(option) ? current.filter((value) => value !== option) : [...current, option])} /><span>{option}</span></label>)}</div></div>
          <div className="column-filter-actions"><button type="button" onClick={() => { setSelectedTitles([]); setOptionQuery(""); }}>Limpar</button><button type="button" onClick={() => setFilterOpen(false)}>Fechar</button></div>
        </div>, document.body) : null}
      </div>
      {items.length === 0 ? (
        <p className="empty-change">Sem alterações nesta categoria.</p>
      ) : (
        <ul>
          {visibleItems.slice(0, 80).map((item, index) => {
            const titleText = typeof item === "string" ? item : entryTitle(item);
            const itemKey = `${title}-${titleText}-${index}`;
            const isExpanded = expandedItems.has(itemKey);
            const sections = compareExpansionSections(item, title, tone);
            const detailClassName = sections.some((section) => section.variant === "single-dax")
              ? "change-detail dax-detail single-dax-detail"
              : sections.some((section) => section.variant === "dax")
                ? "change-detail dax-detail"
                : "change-detail";

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
                  <div className={detailClassName}>
                    {sections.map((section) => (
                      <section key={section.key}>
                        <span>{section.label}</span>
                        <pre>{section.value}</pre>
                      </section>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {normalizedQuery && visibleItems.length === 0 ? <p className="empty-change">Nenhuma alteração encontrada.</p> : null}
      {visibleItems.length > 80 ? <p className="hint">Mostrando os primeiros 80 itens.</p> : null}
    </article>
  );
}

export function CompareView({
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
