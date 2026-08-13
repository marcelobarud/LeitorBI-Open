import { AlertTriangle, Database, Download, FileJson, ShieldCheck, X } from "lucide-react";
import type { Report, Row } from "../types";
import { useLocale } from "../i18n/LocaleProvider";

function formatValue(value: Row[string]) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function numberValue(value: Row[string]) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function Overview({
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
  const { t, locale } = useLocale();
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
    [t("nav.tables"), tables, t("overview.visibleModel")],
    [t("nav.columns"), totalColumns, t("overview.visibleColumns", { count: usedColumns })],
    [t("nav.measures"), measures, t("overview.daxCalculations")],
    [t("nav.sources"), sources, summary["Tipos de fontes"]],
    [t("nav.relationships"), relationships, t("overview.relationshipMap")],
  ];
  const summaryEntries: Array<[string, Row[string]]> = [
    [t("overview.summaryDashboard"), summary["Dashboard"]],
    [t("overview.summaryTotalTables"), summary["Tabelas totais"]],
    [t("overview.summaryModel"), summary["Modelo"]],
    [t("overview.summaryTotalColumns"), summary["Colunas totais"]],
    [t("overview.summaryExportDate"), summary["Data de exportacao"]],
    [t("overview.summaryUsedColumnsInMeasures"), summary["Colunas utilizadas em medidas"]],
    [t("overview.summaryCulture"), summary["Cultura"]],
    [t("overview.summaryMeasures"), summary["Medidas"]],
    [t("overview.summaryDefaultMode"), summary["Modo padrao"]],
    [t("overview.summaryRelationships"), summary["Relacionamentos"]],
    [t("overview.summarySourceTypes"), summary["Tipos de fontes"]],
    [t("overview.summaryDataSources"), summary["Fontes de dados"]],
  ];
  const insightCards = [
    {
      icon: ShieldCheck,
      title: t("overview.ready"),
      value: t("overview.readyValue", { tables, measures }),
      detail: t("overview.readyDescription"),
      tone: "good",
    },
    {
      icon: AlertTriangle,
      title: t("overview.attention"),
      value: t("overview.inactiveRelationship", { count: inactiveRelationships }),
      detail: `${t("overview.hiddenColumn", { count: hiddenColumns })} ${locale === "pt-BR" ? "e" : "and"} ${t("overview.calculatedTable", { count: calculatedTables })}.`,
      tone: inactiveRelationships ? "warn" : "good",
    },
    {
      icon: Database,
      title: t("overview.dataOrigin"),
      value: formatValue(summary["Tipos de fontes"]),
      detail: t("overview.dataOriginDescription"),
      tone: "info",
    },
  ];

  return (
    <div className="overview">
      <section className="model-hero">
        <div>
          <h1>{formatValue(summary["Dashboard"])}</h1>
          <p>
            {formatValue(summary["Modelo"])} | {formatValue(summary["Modo padrao"])} | {formatValue(summary["Data de exportacao"])}
          </p>
        </div>
        {!readOnly ? <div className="model-actions">
          <label className="secondary-action file-action">
            <FileJson size={18} />
            {loading ? t("workspace.analyzing") : t("workspace.replaceJson")}
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
            {exporting ? t("workspace.exporting") : t("workspace.exportExcel")}
          </button>
          <button className="ghost-action" type="button" onClick={onClose}>
            <X size={18} />
            {t("workspace.closeAnalysis")}
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
        {summaryEntries.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{formatValue(value)}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}
