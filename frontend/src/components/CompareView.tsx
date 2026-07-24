import { ChevronDown, GitCompareArrows, Maximize2, Minimize2, Plus, RotateCcw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { compareModels } from "../api";
import { CompareFileInput } from "./CompareFileInput";
import type { CompareEntry, CompareResult, Row } from "../types";
import { useLocale } from "../i18n/LocaleProvider";

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

function getMeasureDaxExpression(item: CompareEntry, fallback: string) {
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

  return fallback;
}

function compareExpansionSections(item: string | CompareEntry, title: string, tone: ChangeTone, labels: { dax: string; before: string; after: string; unavailable: string }) {
  const isMeasureCategory = /^(medidas|added measures|removed measures|changed measures)/i.test(title);

  if (typeof item !== "string" && isMeasureCategory && tone !== "changed") {
    return [
      {
        key: "measure-dax",
        label: labels.dax,
        value: getMeasureDaxExpression(item, labels.unavailable),
        variant: "single-dax",
      },
    ];
  }

  if (typeof item !== "string" && ("antes" in item || "depois" in item)) {
    return [
      { key: "before", label: labels.before, value: compareValueToText(item.antes), variant: "dax" },
      { key: "after", label: labels.after, value: compareValueToText(item.depois), variant: "dax" },
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
  const { t } = useLocale();
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
        <label className="search-box"><Search size={16} /><input aria-label={t("comparison.searchCategory")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("comparison.searchCategory")} /></label>
        <button ref={filterButtonRef} className={filterOpen ? "column-filter-button active" : "column-filter-button"} type="button" aria-label={t("comparison.filterCategory", { category: title })} aria-expanded={filterOpen} onClick={(event) => toggleFilter(event.currentTarget)}><ChevronDown size={16} /></button>
        {filterOpen ? createPortal(<div ref={filterMenuRef} className="column-filter-menu" style={{ ...filterPosition, position: "absolute" }}>
          <label><span>{t("table.searchOptions")}</span><input autoFocus value={optionQuery} onChange={(event) => setOptionQuery(event.target.value)} placeholder={t("table.searchColumn", { column: title })} /></label>
          <div className="column-value-panel"><span>{t("table.uniqueValues")}</span><div className="column-value-list">{visibleOptions.map((option) => <label className={selectedTitles.includes(option) ? "active" : ""} key={option}><input type="checkbox" checked={selectedTitles.includes(option)} onChange={() => setSelectedTitles((current) => current.includes(option) ? current.filter((value) => value !== option) : [...current, option])} /><span>{option}</span></label>)}</div></div>
          <div className="column-filter-actions"><button type="button" onClick={() => { setSelectedTitles([]); setOptionQuery(""); }}>{t("common.clear")}</button><button type="button" onClick={() => setFilterOpen(false)}>{t("common.close")}</button></div>
        </div>, document.body) : null}
      </div>
      {items.length === 0 ? (
        <p className="empty-change">{t("comparison.noChanges")}</p>
      ) : (
        <ul>
          {visibleItems.slice(0, 80).map((item, index) => {
            const titleText = typeof item === "string" ? item : entryTitle(item);
            const itemKey = `${title}-${titleText}-${index}`;
            const isExpanded = expandedItems.has(itemKey);
            const sections = compareExpansionSections(item, title, tone, { dax: t("comparison.daxMeasure"), before: t("comparison.before"), after: t("comparison.after"), unavailable: t("comparison.daxUnavailable") });
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
                    title={t(isExpanded ? "comparison.collapseDetails" : "comparison.expandDetails")}
                    aria-label={t(isExpanded ? "comparison.collapseDetails" : "comparison.expandDetails")}
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
      {normalizedQuery && visibleItems.length === 0 ? <p className="empty-change">{t("comparison.noChangesFound")}</p> : null}
      {visibleItems.length > 80 ? <p className="hint">{t("comparison.firstItems", { count: 80 })}</p> : null}
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
  const { t } = useLocale();
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
      onErrorChange(t("comparison.selectBoth"));
      return;
    }

    onLoadingChange(true);
    onErrorChange("");
    try {
      const comparison = await compareModels(baseFile, newFile);
      onResultChange(normalizeCompareResult(comparison));
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : t("comparison.unexpectedError"));
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
          <h2>{t("comparison.title")}</h2>
          <p>{t("comparison.description")}</p>
        </div>
      </header>

      <section className="compare-picker">
        <CompareFileInput label={t("comparison.baseModel")} file={baseFile} onChange={handleBaseFileChange} />
        <div className="compare-plus">
          <Plus size={20} />
        </div>
        <CompareFileInput label={t("comparison.newModel")} file={newFile} onChange={handleNewFileChange} />
        <div className="compare-actions">
          <button className="primary-action" disabled={loading || !baseFile || !newFile} onClick={handleCompare}>
            {loading ? t("comparison.comparing") : t("comparison.title")}
          </button>
          {hasComparisonState ? (
            <button className="ghost-action" type="button" onClick={onClear} disabled={loading}>
              <RotateCcw size={18} />
              {t("comparison.undo")}
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      {normalizedResult ? (
        <>
          <section className="compare-hero">
            <div>
              <span className="eyebrow">{t("comparison.result")}</span>
              <h1>{t("comparison.fromTo", { base: normalizedResult.dashboard_base, next: normalizedResult.dashboard_novo })}</h1>
            </div>
            <div className="compare-stats">
              <div>
                <span>{t("comparison.added")}</span>
                <strong>{totals.added}</strong>
              </div>
              <div>
                <span>{t("comparison.removed")}</span>
                <strong>{totals.removed}</strong>
              </div>
              <div>
                <span>{t("comparison.changed")}</span>
                <strong>{totals.changed}</strong>
              </div>
            </div>
          </section>

          <section className="change-grid">
            <ChangeList title={t("comparison.tablesAdded")} tone="added" items={normalizedResult.tabelas.adicionadas} />
            <ChangeList title={t("comparison.tablesRemoved")} tone="removed" items={normalizedResult.tabelas.removidas} />
            <ChangeList title={t("comparison.tablesChanged")} tone="changed" items={normalizedResult.tabelas.modificadas} />
            <ChangeList title={t("comparison.columnsAdded")} tone="added" items={normalizedResult.colunas.adicionadas} />
            <ChangeList title={t("comparison.columnsRemoved")} tone="removed" items={normalizedResult.colunas.removidas} />
            <ChangeList title={t("comparison.columnsChanged")} tone="changed" items={normalizedResult.colunas.modificadas} />
            <ChangeList title={t("comparison.measuresAdded")} tone="added" items={normalizedResult.medidas.adicionadas} />
            <ChangeList title={t("comparison.measuresRemoved")} tone="removed" items={normalizedResult.medidas.removidas} />
            <ChangeList title={t("comparison.measuresChanged")} tone="changed" items={normalizedResult.medidas.modificadas} />
            <ChangeList
              title={t("comparison.relationshipsAdded")}
              tone="added"
              items={normalizedResult.relacionamentos.adicionados}
            />
            <ChangeList
              title={t("comparison.relationshipsRemoved")}
              tone="removed"
              items={normalizedResult.relacionamentos.removidos}
            />
            <ChangeList
              title={t("comparison.relationshipsChanged")}
              tone="changed"
              items={normalizedResult.relacionamentos.modificados}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
