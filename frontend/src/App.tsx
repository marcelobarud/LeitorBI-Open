import {
  AlertTriangle,
  BookOpenCheck,
  ClipboardList,
  Download,
  FileJson,
  GitCompareArrows,
  PlayCircle,
  ShieldCheck,
  Table2,
  WandSparkles,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  analyzeModel,
  analyzePublicDemoModel,
  compareModels,
  exportModelExcel,
  ApiError,
} from "./api";
import { useLocale } from "./i18n/LocaleProvider";
import type { TranslationKey } from "./i18n/types";
import { CompareFileInput } from "./components/CompareFileInput";
import { Brand } from "./components/Brand";
import { DataTable } from "./components/DataTable";
import { CompareView } from "./components/CompareView";
import { CompareErrorBoundary } from "./components/CompareErrorBoundary";
import { PBI_MODEL_EXPORT_URL, TABULAR_EDITOR_URL, TechnicalLink } from "./components/TechnicalLink";
import { HomeEmptyState } from "./components/HomeEmptyState";
import { Overview } from "./components/Overview";
import { LandingPage } from "./pages/LandingPage";
import { ROUTES, routeFromPath, type AppRoute } from "./routes";
import type { CompareResult, Report, Row, TabKey } from "./types";

type DataTabKey = Exclude<TabKey, "overview" | "tutorial" | "compare">;

const tabs: Array<{ key: TabKey; label: TranslationKey }> = [
  { key: "overview", label: "nav.home" }, { key: "tutorial", label: "nav.tutorial" }, { key: "tables", label: "nav.tables" }, { key: "columns", label: "nav.columns" }, { key: "measures", label: "nav.measures" }, { key: "sources", label: "nav.sources" }, { key: "relationships", label: "nav.relationships" }, { key: "compare", label: "nav.compare" },
];

const demoTabs: Array<{ key: Exclude<TabKey, "tutorial" | "compare">; label: TranslationKey }> = [
  { key: "overview", label: "nav.overview" }, { key: "tables", label: "nav.tables" }, { key: "columns", label: "nav.columns" }, { key: "measures", label: "nav.measures" }, { key: "sources", label: "nav.sources" }, { key: "relationships", label: "nav.relationships" },
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

function validateJsonFile(file: File, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string | null {
  const isJsonName = file.name.toLowerCase().endsWith(".json");
  const isJsonType = !file.type || file.type === "application/json";
  if (!isJsonName || !isJsonType) {
    return t("workspace.invalidFile");
  }
  if (file.size > MAX_JSON_UPLOAD_BYTES) {
    return t("workspace.uploadTooLarge", { count: MAX_JSON_UPLOAD_MB });
  }
  return null;
}

function TutorialView() {
  const { t } = useLocale();
  const tutorialStep1Detail = t("tutorial.step1Detail");
  const [step1BeforeTabularEditor, step1AfterTabularEditor] = tutorialStep1Detail.split("Tabular Editor");
  type TutorialStep = {
    label: string;
    title: string;
    detail: ReactNode;
    script?: string;
    scriptHref?: string;
    suffix?: string;
  };
  const steps: TutorialStep[] = [
    {
      label: "1",
      title: t("tutorial.step1"),
      detail: (
        <>
          {step1BeforeTabularEditor}
          <TechnicalLink href={TABULAR_EDITOR_URL}>Tabular Editor</TechnicalLink>
          {step1AfterTabularEditor}
        </>
      ),
    },
    {
      label: "2", title: t("tutorial.step2"), detail: t("tutorial.step2Detail"),
    },
    {
      label: "3", title: t("tutorial.step3"), detail: t("tutorial.step3Instructions"),
    },
    {
      label: "4", title: t("tutorial.step4"), detail: t("tutorial.step1Title"),
      script: "PBIModelExport",
      scriptHref: PBI_MODEL_EXPORT_URL,
      suffix: t("tutorial.step1Suffix"),
    },
    {
      label: "5", title: t("tutorial.step5"), detail: t("tutorial.step5Detail"),
    },
    {
      label: "6", title: t("tutorial.step6"), detail: t("tutorial.step6Detail"),
    },
  ];

  const tips = [
    t("tutorial.tip1"), t("tutorial.tip2"), t("tutorial.tip3"),
  ];

  return (
    <div className="tutorial-page">
      <header className="page-header">
        <BookOpenCheck size={22} />
        <div>
          <h2>{t("nav.tutorial")}</h2>
          <p>{t("tutorial.title")}</p>
        </div>
      </header>

      <section className="tutorial-hero">
        <div>
          <h1>{t("tutorial.heading")}</h1>
          <p>{t("tutorial.intro")}</p>
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
                    <TechnicalLink href={step.scriptHref ?? PBI_MODEL_EXPORT_URL}>{step.script}</TechnicalLink>{" "}
                  </>
                ) : null}
                {step.suffix ?? ""}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="tutorial-notes">
        <h3>{t("tutorial.tips")}</h3>
        <ul>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DemoPage({ onBackToLanding }: { onBackToLanding: () => void }) {
  const { t } = useLocale();
  const [demoReport, setDemoReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<Exclude<TabKey, "tutorial" | "compare">>("overview");
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState("");

  useEffect(() => {
    let active = true;

    analyzePublicDemoModel()
      .then((result) => {
        if (active) setDemoReport(result);
      })
      .catch((err) => {
        if (active) setDemoError(err instanceof Error ? err.message : t("demo.loadError"));
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
        <Brand variant="sidebar" className="demo-brand-link" onClick={onBackToLanding} />
        <nav>
          {demoTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.label)}
            </button>
          ))}
        </nav>
        <div className="compare-teaser">
          <ShieldCheck size={18} />
          <span>{t("demo.publicMode")}</span>
        </div>
      </aside>

      <section className="content">
        <header className="workspace-topbar demo-topbar">
          <div>
            <span>{t("demo.title")}</span>
            <strong>{demoReport ? demoReport.raw.dashboardName : t("common.loading")}</strong>
          </div>
          <div className="landing-access">
          </div>
        </header>

        <div className="demo-lock-note">
          <ShieldCheck size={18} />
          <span>{t("demo.readOnly")}</span>
          <a className="ghost-action" href={ROUTES.landing}>
            {t("demo.backHome")}
          </a>
        </div>

        {demoLoading ? <div className="status">{t("demo.loading")}</div> : null}
        {demoError ? <div className="error">{demoError}</div> : null}
        {demoReport && activeTab === "overview" ? <Overview report={demoReport} isDemo readOnly /> : null}
        {demoReport && isDataTab ? (
          <>
            <header className="page-header">
              <Table2 size={22} />
              <div>
                <h2>{t(demoTabs.find((tab) => tab.key === activeTab)?.label ?? "nav.overview")}</h2>
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

function UploadPanel({
  onAnalyze,
  onLoadDemo,
  loadingDemo,
}: {
  onAnalyze: (file: File) => void;
  onLoadDemo: () => void;
  loadingDemo: boolean;
}) {
  const { t } = useLocale();
  return (
    <section className="upload-panel">
      <div className="upload-copy">
        <h1>{t("upload.title")}</h1>
        <p>{t("demo.description")}</p>
        <div className="hero-actions">
          <button className="primary-action" type="button" onClick={onLoadDemo} disabled={loadingDemo}>
            <PlayCircle size={18} />
            {loadingDemo ? t("common.loading") : t("upload.loadExample")}
          </button>
          <span>{t("upload.realJson")}</span>
        </div>
        <div className="hero-proof">
          <div>
            <WandSparkles size={18} />
            <strong>{t("upload.summary")}</strong>
            <span>{t("upload.summaryDetail")}</span>
          </div>
          <div>
            <GitCompareArrows size={18} />
            <strong>{t("upload.comparison")}</strong>
            <span>{t("upload.comparisonDetail")}</span>
          </div>
          <div>
            <Download size={18} />
            <strong>{t("upload.excel")}</strong>
            <span>{t("upload.excelDetail")}</span>
          </div>
        </div>
      </div>

      <label className="drop-zone">
        <FileJson size={42} />
        <strong>{t("workspace.selectModelJson")}</strong>
        <span>{t("upload.apiOnly")}</span>
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

export function App() {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentPath, setCurrentPath] = useState<AppRoute>(() => routeFromPath(window.location.pathname));
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
    function handlePopState() {
      setCurrentPath(routeFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigateTo(path: AppRoute, options: { replace?: boolean } = {}) {
    if (window.location.pathname !== path) {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method](null, "", path);
    }
    setCurrentPath(path);
  }

  function handleApiError(err: unknown, fallback: string, onErrorChange = setError) {
    if (err instanceof ApiError && err.status === 429) {
      onErrorChange(t("api.rateLimited"));
      return;
    }
    onErrorChange(err instanceof Error ? err.message : fallback);
  }

  async function handleAnalyze(file: File) {
    const validationError = validateJsonFile(file, t);
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
      handleApiError(err, t("api.unknown"));
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
        throw new Error(t("workspace.noFile"));
      }
      const blob = await exportModelExcel(currentFile);
      const dashboardName = report?.raw.dashboardName || "leitorbi";
      downloadBlob(blob, `${dashboardName}_analise.xlsx`);
    } catch (err) {
      handleApiError(err, t("api.unknown"));
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

  const visibleTabs = tabs;
  const isDataTab = !["overview", "tutorial", "compare"].includes(activeTab);
  const activeRows = isDataTab ? rowsByTab[activeTab as DataTabKey] : [];

  if (currentPath === ROUTES.demo) return <DemoPage onBackToLanding={() => navigateTo(ROUTES.landing)} />;
  if (currentPath === ROUTES.landing) return <LandingPage onStart={() => navigateTo(ROUTES.app)} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand variant="sidebar" onClick={() => navigateTo(ROUTES.landing)} />
        <nav>
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "active" : ""}
              disabled={!report && !["overview", "tutorial", "compare"].includes(tab.key)}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.label)}
            </button>
          ))}
        </nav>
        <div className="compare-teaser">
          <GitCompareArrows size={18} />
          <span>{t("workspace.compareHint")}</span>
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
            <span>{t("workspace.title")}</span>
            <strong>{report ? report.raw.dashboardName : pendingFileLabel || t("workspace.noModel")}</strong>
          </div>
          {!report ? (
            <button className="secondary-action" type="button" onClick={openFilePicker} disabled={loading}>
              <FileJson size={18} />
              {loading ? t("workspace.analyzing") : t("workspace.uploadJson")}
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
        {loading ? <div className="status" role="status">{t("workspace.analyzingModel")}</div> : null}
        {error ? <div className="error" role="alert">{error}</div> : null}
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
          <CompareErrorBoundary onReset={handleClearComparison} messages={{ title: t("comparison.renderError"), description: t("comparison.renderErrorDescription"), clear: t("comparison.clear") }}>
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
        {report && isDataTab ? (
          <>
            <header className="page-header">
              <Table2 size={22} />
              <div>
                <h2>{t(visibleTabs.find((tab) => tab.key === activeTab)?.label ?? "nav.overview")}</h2>
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
