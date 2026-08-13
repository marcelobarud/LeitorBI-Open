import { ChevronLeft, ChevronRight, Filter, Maximize2, Minimize2, Search, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { Row } from "../types";
import { useLocale } from "../i18n/LocaleProvider";

const PAGE_SIZE = 250;
const UNIQUE_FILTER_LIMIT = 120;
const TABLE_SEARCH_DEBOUNCE_MS = 180;

function formatValue(value: Row[string]) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

export function DataTable({ rows }: { rows: Row[] }) {
  const { t } = useLocale();
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
        <strong>{t("table.empty")}</strong>
        <span>{t("table.emptyDescription")}</span>
      </section>
    );
  }

  return (
    <section className="data-shell">
      <div className="table-toolbar">
        <div>
          <strong>{visibleRows.length}</strong>
          <span>{t("table.records", { count: visibleRows.length }).replace(String(visibleRows.length), "")}</span>
          {visibleRows.length > PAGE_SIZE ? (
            <small>
              {t("table.showingRange", { start: startIndex + 1, end: endIndex })}
            </small>
          ) : null}
        </div>
        <label className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("table.searchAll")} />
        </label>
        {activeColumnFilterCount ? (
          <button className="clear-filters-button" type="button" onClick={clearAllColumnFilters}>
            <X size={15} />
            {t("table.clearFilters", { count: activeColumnFilterCount })}
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="row-action-header">{t("common.details")}</th>
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
                        title={t("table.filterColumn", { column })}
                        aria-label={t("table.filterColumn", { column })}
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
                            <span>{t("table.searchOptions")}</span>
                            <input
                              autoFocus
                              value={optionSearchValue}
                              onChange={(event) => updateColumnOptionSearch(column, event.target.value)}
                              placeholder={t("table.searchColumn", { column })}
                            />
                          </label>
                          {hasFilter ? (
                            <p className="column-filter-current">
                              {t("table.selectedValues", { count: selectedFilterValues.length })}
                            </p>
                          ) : null}
                          <div className="column-value-panel">
                            <span>{t("table.uniqueValues")}</span>
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
                                <p>{t("common.noValues")}</p>
                              )}
                            </div>
                            {uniqueValues.length > UNIQUE_FILTER_LIMIT ? (
                              <small>{t("table.showingValues", { shown: UNIQUE_FILTER_LIMIT, total: uniqueValues.length })}</small>
                            ) : null}
                          </div>
                          <div className="column-filter-actions">
                            <button type="button" onClick={() => clearColumnFilter(column)} disabled={!hasFilter}>
                              {t("common.clear")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenFilterColumn(null);
                                setFilterMenuPosition(null);
                              }}
                            >
                              {t("common.close")}
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
              const isExpanded = expandedRows.has(rowIndex);
              return (
                <Fragment key={`row-group-${rowIndex}`}>
                  <tr key={`row-${rowIndex}`}>
                    <td className="row-action-cell">
                      <button
                        className="icon-action"
                        type="button"
                        title={t(isExpanded ? "table.collapseRow" : "table.expandRow")}
                        aria-label={t(isExpanded ? "table.collapseRow" : "table.expandRow")}
                        aria-expanded={isExpanded}
                        aria-controls={`expanded-${rowIndex}`}
                        onClick={() => toggleRow(rowIndex)}
                      >
                        {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                      </button>
                    </td>
                    {columns.map((column) => (
                      <td key={column}>{formatValue(row[column])}</td>
                    ))}
                  </tr>
                  {isExpanded ? (
                    <tr className="expanded-row" id={`expanded-${rowIndex}`} key={`expanded-${rowIndex}`}>
                      <td colSpan={columns.length + 1}>
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
            {t("table.pageOf", { current: currentPage, total: totalPages })}
          </span>
          <div>
            <button
              type="button"
              className="pagination-button"
              disabled={currentPage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} />
              {t("common.previous")}
            </button>
            <button
              type="button"
              className="pagination-button"
              disabled={currentPage === totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              {t("common.next")}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
