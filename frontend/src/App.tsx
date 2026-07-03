import { BarChart3, Database, FileJson, GitCompareArrows, Plus, Search, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { analyzeModel, compareModels } from "./api";
import type { CompareEntry, CompareResult, Report, Row, TabKey } from "./types";

type DataTabKey = Exclude<TabKey, "overview" | "compare">;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Inicio" },
  { key: "tables", label: "Tabelas" },
  { key: "columns", label: "Colunas" },
  { key: "measures", label: "Medidas" },
  { key: "sources", label: "Fontes" },
  { key: "relationships", label: "Relacoes" },
  { key: "compare", label: "Comparar" },
];

function formatValue(value: Row[string]) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function DataTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => formatValue(value).toLowerCase().includes(normalized)),
    );
  }, [query, rows]);

  return (
    <section className="data-shell">
      <div className="table-toolbar">
        <div>
          <strong>{visibleRows.length}</strong>
          <span> registros</span>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar em tudo" />
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.slice(0, 250).map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column}>{formatValue(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleRows.length > 250 && <p className="hint">Mostrando os primeiros 250 registros filtrados.</p>}
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
      result.tabelas.adicionadas.length +
      result.colunas.adicionadas.length +
      result.medidas.adicionadas.length +
      result.relacionamentos.adicionados.length,
    removed:
      result.tabelas.removidas.length +
      result.colunas.removidas.length +
      result.medidas.removidas.length +
      result.relacionamentos.removidos.length,
    changed:
      result.tabelas.modificadas.length +
      result.medidas.modificadas.length,
  };
}

function entryTitle(entry: CompareEntry, fallback = "Item") {
  return String(entry.nome ?? entry.medida ?? entry.coluna ?? entry.tabela ?? fallback);
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
  return (
    <article className="change-list">
      <header>
        <span className={`badge ${tone}`}>{items.length}</span>
        <h3>{title}</h3>
      </header>
      {items.length === 0 ? (
        <p className="empty-change">Sem alteracoes nesta categoria.</p>
      ) : (
        <ul>
          {items.slice(0, 80).map((item, index) => {
            const titleText = typeof item === "string" ? item : entryTitle(item);
            const detail =
              typeof item === "string"
                ? ""
                : Object.entries(item)
                    .filter(([key]) => !["antes", "depois"].includes(key))
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : formatValue(value)}`)
                    .join(" | ");

            return (
              <li key={`${titleText}-${index}`}>
                <strong>{titleText}</strong>
                {detail ? <span>{detail}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 80 ? <p className="hint">Mostrando os primeiros 80 itens.</p> : null}
    </article>
  );
}

function CompareView() {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCompare() {
    if (!baseFile || !newFile) {
      setError("Selecione os dois JSONs para comparar.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const comparison = await compareModels(baseFile, newFile);
      setResult(comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao comparar.");
    } finally {
      setLoading(false);
    }
  }

  const totals = result ? countCompareChanges(result) : { added: 0, removed: 0, changed: 0 };

  return (
    <div className="compare-page">
      <header className="page-header">
        <GitCompareArrows size={22} />
        <div>
          <h2>Comparar modelos</h2>
          <p>Escolha dois exports JSON para descobrir o que mudou entre versoes.</p>
        </div>
      </header>

      <section className="compare-picker">
        <CompareFileInput label="Modelo base" file={baseFile} onChange={setBaseFile} />
        <div className="compare-plus">
          <Plus size={20} />
        </div>
        <CompareFileInput label="Modelo novo" file={newFile} onChange={setNewFile} />
        <button className="primary-action" disabled={loading || !baseFile || !newFile} onClick={handleCompare}>
          {loading ? "Comparando..." : "Comparar modelos"}
        </button>
      </section>

      {error ? <div className="error">{error}</div> : null}

      {result ? (
        <>
          <section className="compare-hero">
            <div>
              <span className="eyebrow">Resultado da comparacao</span>
              <h1>{result.dashboard_base} para {result.dashboard_novo}</h1>
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
            <ChangeList title="Tabelas adicionadas" tone="added" items={result.tabelas.adicionadas} />
            <ChangeList title="Tabelas removidas" tone="removed" items={result.tabelas.removidas} />
            <ChangeList title="Tabelas modificadas" tone="changed" items={result.tabelas.modificadas} />
            <ChangeList title="Colunas adicionadas" tone="added" items={result.colunas.adicionadas} />
            <ChangeList title="Colunas removidas" tone="removed" items={result.colunas.removidas} />
            <ChangeList title="Medidas adicionadas" tone="added" items={result.medidas.adicionadas} />
            <ChangeList title="Medidas removidas" tone="removed" items={result.medidas.removidas} />
            <ChangeList title="Medidas modificadas" tone="changed" items={result.medidas.modificadas} />
            <ChangeList title="Relacionamentos adicionados" tone="added" items={result.relacionamentos.adicionados} />
            <ChangeList title="Relacionamentos removidos" tone="removed" items={result.relacionamentos.removidos} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function UploadPanel({ onAnalyze }: { onAnalyze: (file: File) => void }) {
  return (
    <section className="upload-panel">
      <div className="upload-copy">
        <span className="eyebrow">LeitorBI Web</span>
        <h1>Explore modelos Power BI com mais calma, clareza e beleza.</h1>
        <p>Envie o JSON exportado pelo Tabular Editor para abrir tabelas, medidas, fontes e relacoes em uma leitura web.</p>
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

function Overview({ report }: { report: Report }) {
  const summary = report.summary;
  const cards: Array<[string, Row[string], Row[string]]> = [
    ["Tabelas", summary["Tabelas utilizadas no modelo"], "Modelo visivel"],
    ["Colunas", summary["Colunas totais"], "Inventario completo"],
    ["Medidas", summary["Medidas"], "Calculos DAX"],
    ["Fontes", summary["Fontes de dados"], summary["Tipos de fontes"]],
    ["Relacoes", summary["Relacionamentos"], "Mapa sem tabelas tecnicas"],
  ];

  return (
    <div className="overview">
      <section className="model-hero">
        <div>
          <span className="eyebrow">Modelo carregado</span>
          <h1>{formatValue(summary["Dashboard"])}</h1>
          <p>
            {formatValue(summary["Modelo"])} | {formatValue(summary["Modo padrao"])} | {formatValue(summary["Data de exportacao"])}
          </p>
        </div>
        <BarChart3 size={48} />
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
  const [report, setReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze(file: File) {
    setLoading(true);
    setError("");
    try {
      const result = await analyzeModel(file);
      setReport(result);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const rowsByTab: Record<DataTabKey, Row[]> = {
    tables: report?.tables ?? [],
    columns: report?.columns ?? [],
    measures: report?.measures ?? [],
    sources: report?.sources ?? [],
    relationships: report?.relationships ?? [],
  };

  const activeRows = activeTab === "overview" ? [] : rowsByTab[activeTab as DataTabKey];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Database size={24} />
          <span>LeitorBI</span>
        </div>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              disabled={!report && !["overview", "compare"].includes(tab.key)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="compare-teaser">
          <GitCompareArrows size={18} />
          <span>Compare dois exports JSON lado a lado.</span>
        </div>
      </aside>

      <section className="content">
        {!report && activeTab === "overview" ? <UploadPanel onAnalyze={handleAnalyze} /> : null}
        {loading ? <div className="status">Analisando modelo...</div> : null}
        {error ? <div className="error">{error}</div> : null}
        {report && activeTab === "overview" ? <Overview report={report} /> : null}
        {activeTab === "compare" ? <CompareView /> : null}
        {report && activeTab !== "overview" && activeTab !== "compare" ? (
          <>
            <header className="page-header">
              <Table2 size={22} />
              <div>
                <h2>{tabs.find((tab) => tab.key === activeTab)?.label}</h2>
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
