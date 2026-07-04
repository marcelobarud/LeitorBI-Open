import {
  AlertTriangle,
  BookOpenCheck,
  ClipboardList,
  Database,
  Download,
  Maximize2,
  Minimize2,
  FileJson,
  GitCompareArrows,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Table2,
  WandSparkles,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { analyzeDemoModel, analyzeModel, compareModels, exportDemoExcel, exportModelExcel } from "./api";
import type { CompareEntry, CompareResult, Report, Row, TabKey } from "./types";

type DataTabKey = Exclude<TabKey, "overview" | "tutorial" | "compare">;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Inicio" },
  { key: "tutorial", label: "Tutorial" },
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

function DataTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) => formatValue(value).toLowerCase().includes(normalized)),
    );
  }, [query, rows]);
  const hasExpandableRows = visibleRows.some(hasExpandableContent);

  useEffect(() => {
    setExpandedRows(new Set());
  }, [query, rows]);

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
              {hasExpandableRows ? <th className="row-action-header">Detalhes</th> : null}
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.slice(0, 250).map((row, index) => {
              const isExpandable = hasExpandableContent(row);
              const isExpanded = expandedRows.has(index);
              return (
                <Fragment key={`row-group-${index}`}>
                  <tr key={`row-${index}`}>
                    {hasExpandableRows ? (
                      <td className="row-action-cell">
                        {isExpandable ? (
                          <button
                            className="icon-action"
                            type="button"
                            title={isExpanded ? "Recolher linha" : "Expandir linha"}
                            aria-label={isExpanded ? "Recolher linha" : "Expandir linha"}
                            onClick={() => toggleRow(index)}
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
                    <tr className="expanded-row" key={`expanded-${index}`}>
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

function TutorialView() {
  const steps = [
    {
      label: "PASSO 1",
      title: "Abra o Power BI Desktop",
      detail: "Abra o arquivo .pbix e aguarde o modelo carregar.",
    },
    {
      label: "PASSO 2",
      title: "Abra o Tabular Editor",
      detail: "Acesse Ferramentas externas e conecte o Tabular Editor ao modelo.",
    },
    {
      label: "PASSO 3",
      title: "Execute o script de exportacao",
      detail: "Execute o script",
      script: "PBIXExportModel",
      suffix: "para gerar o JSON de analise.",
    },
    {
      label: "PASSO 4",
      title: "Abra o JSON no LeitorBI",
      detail: "Clique em Carregar JSON e selecione o arquivo salvo na pasta Downloads.",
    },
    {
      label: "PASSO 5",
      title: "Analise e exporte",
      detail: "Use filtros, detalhamentos e Exportar Excel para compartilhar a analise.",
    },
  ];

  const tips = [
    "O script destacado e o responsavel por extrair o modelo em JSON para leitura no LeitorBI.",
    "Se o JSON nao aparecer, confirme se o Power BI terminou de carregar o modelo antes de executar o script.",
    "Depois da extracao, o fluxo continua pela aba Inicio com o botao de carregar JSON.",
  ];

  return (
    <div className="tutorial-page">
      <header className="page-header">
        <BookOpenCheck size={22} />
        <div>
          <h2>Tutorial</h2>
          <p>Como extrair o JSON do Power BI e abrir a analise no LeitorBI.</p>
        </div>
      </header>

      <section className="tutorial-hero">
        <div>
          <span className="eyebrow">Extracao do modelo</span>
          <h1>Gere o JSON pelo Tabular Editor e continue a analise no LeitorBI.</h1>
          <p>
            O passo central e executar o script de exportacao usado para transformar o modelo aberto no Power BI em um
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
          Abra tabelas, medidas, fontes, relacoes e mudancas do modelo em uma interface leve para revisar com o time.
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
            <strong>Comparacao visual</strong>
            <span>Mudancas agrupadas entre dois exports.</span>
          </div>
          <div>
            <Download size={18} />
            <strong>Entrega em Excel</strong>
            <span>Inventario completo para compartilhar.</span>
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

function Overview({
  report,
  onAnalyze,
  onClose,
  onExport,
  loading,
  exporting,
  isDemo,
}: {
  report: Report;
  onAnalyze: (file: File) => void;
  onClose: () => void;
  onExport: () => void;
  loading: boolean;
  exporting: boolean;
  isDemo: boolean;
}) {
  const summary = report.summary;
  const tables = numberValue(summary["Tabelas totais"]);
  const totalColumns = numberValue(summary["Colunas totais"]);
  const usedColumns = numberValue(summary["Colunas utilizadas"]);
  const measures = numberValue(summary["Medidas"]);
  const sources = numberValue(summary["Fontes de dados"]);
  const relationships = numberValue(summary["Relacionamentos"]);
  const inactiveRelationships = report.relationships.filter((row) => formatValue(row["Ativo"]) === "Nao").length;
  const hiddenColumns = report.columns.filter((row) => formatValue(row["Oculto"]) === "Sim").length;
  const calculatedTables = report.tables.filter((row) => formatValue(row["Tipo"]).toLowerCase().includes("calculada")).length;
  const cards: Array<[string, Row[string], Row[string]]> = [
    ["Tabelas", tables, "Modelo visivel"],
    ["Colunas", totalColumns, `${usedColumns} visiveis`],
    ["Medidas", measures, "Calculos DAX"],
    ["Fontes", sources, summary["Tipos de fontes"]],
    ["Relacoes", relationships, "Mapa sem tabelas tecnicas"],
  ];
  const insightCards = [
    {
      icon: ShieldCheck,
      title: "Pronto para leitura",
      value: `${tables} tabelas e ${measures} medidas`,
      detail: "Inventario centralizado para revisar estrutura, fonte e DAX.",
      tone: "good",
    },
    {
      icon: AlertTriangle,
      title: "Pontos de atencao",
      value: pluralize(inactiveRelationships, "relacao inativa", "relacoes inativas"),
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
      detail: "Tipos de conexao detectados pelas expressoes M das particoes.",
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
        <div className="model-actions">
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
                if (file) onAnalyze(file);
              }}
            />
          </label>
          <button className="secondary-action" type="button" onClick={onExport} disabled={exporting}>
            <Download size={18} />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </button>
          <button className="ghost-action" type="button" onClick={onClose}>
            <X size={18} />
            Fechar analise
          </button>
        </div>
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
  const [report, setReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze(file: File) {
    setLoading(true);
    setError("");
    try {
      const result = await analyzeModel(file);
      setReport(result);
      setCurrentFile(file);
      setIsDemo(false);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadDemo() {
    setLoadingDemo(true);
    setError("");
    try {
      const result = await analyzeDemoModel();
      setReport(result);
      setCurrentFile(null);
      setIsDemo(true);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar exemplo.");
    } finally {
      setLoadingDemo(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const blob = isDemo || !currentFile ? await exportDemoExcel() : await exportModelExcel(currentFile);
      const dashboardName = report?.raw.dashboardName || "leitorbi";
      downloadBlob(blob, `${dashboardName}_analise.xlsx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  function handleCloseAnalysis() {
    setReport(null);
    setCurrentFile(null);
    setIsDemo(false);
    setError("");
    setActiveTab("overview");
  }

  const rowsByTab: Record<DataTabKey, Row[]> = {
    tables: report?.tables ?? [],
    columns: report?.columns ?? [],
    measures: report?.measures ?? [],
    sources: report?.sources ?? [],
    relationships: report?.relationships ?? [],
  };

  const isDataTab = !["overview", "tutorial", "compare"].includes(activeTab);
  const activeRows = isDataTab ? rowsByTab[activeTab as DataTabKey] : [];

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
              disabled={!report && !["overview", "tutorial", "compare"].includes(tab.key)}
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
        {!report && activeTab === "overview" ? (
          <UploadPanel onAnalyze={handleAnalyze} onLoadDemo={handleLoadDemo} loadingDemo={loadingDemo} />
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
            isDemo={isDemo}
          />
        ) : null}
        {activeTab === "tutorial" ? <TutorialView /> : null}
        {activeTab === "compare" ? <CompareView /> : null}
        {report && isDataTab ? (
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
