import { GitCompareArrows, Maximize2, Minimize2, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
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
