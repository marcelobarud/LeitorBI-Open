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
  type KeyboardEvent,
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
import { ModelPreparationError, prepareModelUpload, type PreparedModelUpload } from "./lib/pbip/preparation";
import { validateModelFile } from "./lib/pbip/validateModelFile";

type DataTabKey = Exclude<TabKey, "overview" | "tutorial" | "compare">;

const tabs: Array<{ key: TabKey; label: TranslationKey }> = [
  { key: "overview", label: "nav.home" }, { key: "tutorial", label: "nav.tutorial" }, { key: "tables", label: "nav.tables" }, { key: "columns", label: "nav.columns" }, { key: "measures", label: "nav.measures" }, { key: "sources", label: "nav.sources" }, { key: "relationships", label: "nav.relationships" }, { key: "compare", label: "nav.compare" },
];

const demoTabs: Array<{ key: Exclude<TabKey, "tutorial" | "compare">; label: TranslationKey }> = [
  { key: "overview", label: "nav.overview" }, { key: "tables", label: "nav.tables" }, { key: "columns", label: "nav.columns" }, { key: "measures", label: "nav.measures" }, { key: "sources", label: "nav.sources" }, { key: "relationships", label: "nav.relationships" },
];

const PAGE_SIZE = 250;
const UNIQUE_FILTER_LIMIT = 120;
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

function formatFileSize(size: number, locale: string) {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${formatter.format(size / (1024 * 1024))} MB`;
}

function TutorialView() {
  const { t } = useLocale();
  const tutorialStep1Detail = t("tutorial.step1Detail");
  const [step1BeforeTabularEditor, step1AfterTabularEditor] = tutorialStep1Detail.split("Tabular Editor");
  const tutorialScriptDetail = t("tutorial.step1Title");
  const [scriptDetailBeforeName, scriptDetailAfterName] = tutorialScriptDetail.split("PBIModelExport");
  const [activeMethod, setActiveMethod] = useState<"pbip" | "tabular">("pbip");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const methods = [
    { key: "pbip", label: t("tutorial.tabPBIP") },
    { key: "tabular", label: t("tutorial.tabTabularEditor") },
  ] as const;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % methods.length;
    else if (event.key === "ArrowLeft") nextIndex = (index + methods.length - 1) % methods.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = methods.length - 1;
    else return;

    event.preventDefault();
    const nextMethod = methods[nextIndex];
    setActiveMethod(nextMethod.key);
    tabRefs.current[nextIndex]?.focus();
  }

  type TutorialStep = {
    label: string;
    title: string;
    detail: ReactNode;
    suffix?: string;
  };
  const pbipSteps: TutorialStep[] = [
    { label: "1", title: t("tutorial.pbipStep1Title"), detail: t("tutorial.pbipStep1Detail") },
    { label: "2", title: t("tutorial.pbipStep2Title"), detail: t("tutorial.pbipStep2Detail") },
    { label: "3", title: t("tutorial.pbipStep3Title"), detail: t("tutorial.pbipStep3Detail") },
    { label: "4", title: t("tutorial.pbipStep4Title"), detail: t("tutorial.pbipStep4Detail") },
    { label: "5", title: t("tutorial.pbipStep5Title"), detail: t("tutorial.pbipStep5Detail") },
  ];
  const tabularSteps: TutorialStep[] = [
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
      label: "4", title: t("tutorial.step4"),
      detail: <>{scriptDetailBeforeName}<TechnicalLink href={PBI_MODEL_EXPORT_URL}>PBIModelExport</TechnicalLink>{scriptDetailAfterName}</>,
      suffix: t("tutorial.step1Suffix"),
    },
    {
      label: "5", title: t("tutorial.step5"), detail: t("tutorial.step5Detail"),
    },
  ];

  const tips = [
    t("tutorial.tip1"), t("tutorial.tip2"), t("tutorial.tip3"),
  ];

  function renderSteps(steps: TutorialStep[]) {
    return (
      <section className="tutorial-steps">
        {steps.map((step) => (
          <article className="tutorial-step" key={step.title}>
            <span>{step.label}</span>
            <div>
              <h3>{step.title}</h3>
              <p>
                {step.detail}
                {step.suffix ?? ""}
              </p>
            </div>
          </article>
        ))}
      </section>
    );
  }

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

      <div className="tutorial-tabs" role="tablist" aria-label={t("tutorial.tabsLabel")}>
        {methods.map((method, index) => (
          <button
            key={method.key}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`tutorial-tab-${method.key}`}
            className="tutorial-tab"
            type="button"
            role="tab"
            aria-selected={activeMethod === method.key}
            aria-controls={`tutorial-panel-${method.key}`}
            tabIndex={activeMethod === method.key ? 0 : -1}
            onClick={() => setActiveMethod(method.key)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {method.label}
          </button>
        ))}
      </div>

      <section
        className="tutorial-tab-panel"
        id="tutorial-panel-pbip"
        role="tabpanel"
        aria-labelledby="tutorial-tab-pbip"
        tabIndex={0}
        hidden={activeMethod !== "pbip"}
      >
        <header className="tutorial-method-heading">
          <h2>{t("tutorial.tabPBIP")} <span>{t("tutorial.recommended")}</span></h2>
          <p>{t("tutorial.pbipIntro")}</p>
        </header>
        {renderSteps(pbipSteps)}
      </section>

      <section
        className="tutorial-tab-panel"
        id="tutorial-panel-tabular"
        role="tabpanel"
        aria-labelledby="tutorial-tab-tabular"
        tabIndex={0}
        hidden={activeMethod !== "tabular"}
      >
        <header className="tutorial-method-heading">
          <h2>{t("tutorial.tabTabularEditor")}</h2>
          <p>{t("tutorial.tabularSubtitle")}</p>
        </header>
        {renderSteps(tabularSteps)}
        <section className="tutorial-notes">
          <h3>{t("tutorial.tips")}</h3>
          <ul>
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
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
          <span>{t("upload.realModel")}</span>
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
        <strong>{t("workspace.selectModelFile")}</strong>
        <span>{t("upload.apiOnly")}</span>
        <input
          type="file"
          accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
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
  const { t, locale } = useLocale();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentPath, setCurrentPath] = useState<AppRoute>(() => routeFromPath(window.location.pathname));
  const [report, setReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentUpload, setCurrentUpload] = useState<PreparedModelUpload | null>(null);
  const [preparationNotices, setPreparationNotices] = useState<PreparedModelUpload[]>([]);
  const [pendingFileLabel, setPendingFileLabel] = useState("");
  const [error, setError] = useState("");
  const [compareBaseFile, setCompareBaseFile] = useState<File | null>(null);
  const [compareNewFile, setCompareNewFile] = useState<File | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareBaseUpload, setCompareBaseUpload] = useState<PreparedModelUpload | null>(null);
  const [compareNewUpload, setCompareNewUpload] = useState<PreparedModelUpload | null>(null);
  const [preparationStatusKey, setPreparationStatusKey] = useState<TranslationKey | null>(null);
  const [preparationFallback, setPreparationFallback] = useState<{
    code: "operational" | "multiple-caches";
    fileCount: number;
  } | null>(null);
  const preparationController = useRef<AbortController | null>(null);
  const originalFallbackResolver = useRef<((sendOriginal: boolean) => void) | null>(null);

  useEffect(() => {
    function handlePopState() {
      cancelPreparation();
      setCurrentPath(routeFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      cancelPreparation(false);
    };
  }, []);

  function navigateTo(path: AppRoute, options: { replace?: boolean } = {}) {
    if (window.location.pathname !== path) {
      cancelPreparation();
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

  function originalUpload(file: File): PreparedModelUpload {
    return { original: file, file, inspected: false, cacheRemoved: false, originalSize: file.size, preparedSize: file.size };
  }

  function requestOriginalFallback(code: "operational" | "multiple-caches", fileCount: number): Promise<boolean> {
    setPreparationFallback({ code, fileCount });
    return new Promise((resolve) => {
      originalFallbackResolver.current = resolve;
    });
  }

  function finishOriginalFallback(sendOriginal: boolean) {
    setPreparationFallback(null);
    const resolve = originalFallbackResolver.current;
    originalFallbackResolver.current = null;
    resolve?.(sendOriginal);
  }

  function cancelPreparation(updateUi = true) {
    preparationController.current?.abort();
    if (updateUi) {
      finishOriginalFallback(false);
    } else {
      const resolve = originalFallbackResolver.current;
      originalFallbackResolver.current = null;
      resolve?.(false);
    }
  }

  async function prepareFiles(
    files: File[],
    statusKeys: TranslationKey[],
    reusable: Array<PreparedModelUpload | null> = [],
  ): Promise<PreparedModelUpload[] | null> {
    const controller = new AbortController();
    preparationController.current = controller;
    setPreparationFallback(null);
    const prepared: PreparedModelUpload[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const existing = reusable[index];
        if (existing?.original === file && (existing.inspected || !file.name.toLowerCase().endsWith(".zip"))) {
          prepared.push(existing);
          continue;
        }
        if (file.name.toLowerCase().endsWith(".zip")) setPreparationStatusKey(statusKeys[index] ?? "workspace.preparingProject");
        try {
          prepared.push(await prepareModelUpload(file, { signal: controller.signal }));
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return null;
          if (err instanceof ModelPreparationError && err.code === "unsafe") throw err;
          const code = err instanceof ModelPreparationError && err.code === "multiple-caches"
            ? "multiple-caches"
            : "operational";
          setPreparationStatusKey(null);
          const sendOriginal = await requestOriginalFallback(code, files.length);
          if (!sendOriginal) return null;
          return files.map(originalUpload);
        }
      }
      return prepared;
    } finally {
      if (preparationController.current === controller) preparationController.current = null;
      setPreparationStatusKey(null);
    }
  }

  async function handleAnalyze(file: File) {
    if (loading || compareLoading || exporting) return;
    const validationError = validateModelFile(file, t);
    if (validationError) {
      setError(validationError);
      setPendingFileLabel(`${file.name} (${formatFileSize(file.size, locale)})`);
      return;
    }

    setLoading(true);
    setError("");
    setPendingFileLabel(`${file.name} (${formatFileSize(file.size, locale)})`);
    try {
      const uploads = await prepareFiles([file], ["workspace.preparingProject"]);
      if (!uploads) return;
      const upload = uploads[0];
      const result = await analyzeModel(upload.file);
      setReport(result);
      setCurrentFile(file);
      setCurrentUpload(upload);
      setPreparationNotices(upload.cacheRemoved ? [upload] : []);
      setActiveTab("overview");
    } catch (err) {
      if (err instanceof ModelPreparationError && err.code === "unsafe") setError(t("workspace.preparationUnsafe"));
      else handleApiError(err, t("api.unknown"));
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
    if (loading || compareLoading || exporting) return;
    setExporting(true);
    setError("");
    try {
      if (!currentFile) {
        throw new Error(t("workspace.noFile"));
      }
      let upload = currentUpload?.original === currentFile
        && (currentUpload.inspected || !currentFile.name.toLowerCase().endsWith(".zip"))
        ? currentUpload
        : null;
      if (!upload) {
        const uploads = await prepareFiles([currentFile], ["workspace.preparingProject"]);
        if (!uploads) return;
        upload = uploads[0];
        setCurrentUpload(upload);
      }
      const blob = await exportModelExcel(upload.file);
      setPreparationNotices(upload.cacheRemoved ? [upload] : []);
      const dashboardName = report?.raw.dashboardName || "leitorbi";
      downloadBlob(blob, `${dashboardName}_analise.xlsx`);
    } catch (err) {
      if (err instanceof ModelPreparationError && err.code === "unsafe") setError(t("workspace.preparationUnsafe"));
      else handleApiError(err, t("api.unknown"));
    } finally {
      setExporting(false);
    }
  }

  function handleCloseAnalysis() {
    setReport(null);
    setCurrentFile(null);
    setCurrentUpload(null);
    setPreparationNotices([]);
    setPendingFileLabel("");
    setError("");
    setActiveTab("overview");
  }

  function handleClearComparison() {
    setCompareBaseFile(null);
    setCompareNewFile(null);
    setCompareBaseUpload(null);
    setCompareNewUpload(null);
    setCompareResult(null);
    setCompareLoading(false);
    setCompareError("");
  }

  function handleCompareBaseFileChange(file: File | null) {
    setCompareBaseFile(file);
    setCompareBaseUpload(null);
  }

  function handleCompareNewFileChange(file: File | null) {
    setCompareNewFile(file);
    setCompareNewUpload(null);
  }

  async function handleCompareUpload(base: File, next: File): Promise<CompareResult | null> {
    if (loading || exporting) return null;
    try {
      const uploads = await prepareFiles(
        [base, next],
        ["workspace.preparingBase", "workspace.preparingNew"],
        [compareBaseUpload, compareNewUpload],
      );
      if (!uploads) return null;
      setCompareBaseUpload(uploads[0]);
      setCompareNewUpload(uploads[1]);
      setPreparationNotices(uploads.filter((upload) => upload.cacheRemoved));
      return await compareModels(uploads[0].file, uploads[1].file);
    } catch (err) {
      if (err instanceof ModelPreparationError && err.code === "unsafe") {
        throw new Error(t("workspace.preparationUnsafe"));
      }
      throw err;
    }
  }

  const rowsByTab: Record<DataTabKey, Row[]> = {
    tables: report?.tables ?? [],
    columns: report?.columns ?? [],
    measures: report?.measures ?? [],
    sources: report?.sources ?? [],
    relationships: report?.relationships ?? [],
  };

  const visibleTabs = tabs;
  const isBusy = loading || compareLoading || exporting;
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
              disabled={isBusy || (!report && !["overview", "tutorial", "compare"].includes(tab.key))}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.label)}
            </button>
          ))}
        </nav>
        <div className="compare-teaser">
          <GitCompareArrows size={18} />
          <span>{t("workspace.compareHintModels")}</span>
        </div>
      </aside>

      <section className="content">
        <input
          ref={fileInputRef}
          className="workspace-file-input"
          type="file"
          accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
          onChange={handleFileInputChange}
        />
        <header className="workspace-topbar">
          <div>
            <span>{t("workspace.title")}</span>
            <strong>{report ? report.raw.dashboardName : pendingFileLabel || t("workspace.noModel")}</strong>
          </div>
          {!report ? (
            <button className="secondary-action" type="button" onClick={openFilePicker} disabled={isBusy}>
              <FileJson size={18} />
              {loading ? t("workspace.analyzing") : t("workspace.uploadModel")}
            </button>
          ) : null}
        </header>
        {!report && activeTab === "overview" ? (
          <HomeEmptyState
            onOpenFilePicker={openFilePicker}
            disabled={isBusy}
            selectedFileLabel={pendingFileLabel}
          />
        ) : null}
        {preparationStatusKey ? (
          <div className="status preparation-status" role="status" aria-live="polite">
            <span>{t(preparationStatusKey)}</span>
            <button className="ghost-action" type="button" onClick={() => cancelPreparation()}>{t("workspace.cancelPreparation")}</button>
          </div>
        ) : loading && !preparationFallback ? <div className="status" role="status">{t("workspace.analyzingModel")}</div> : null}
        {preparationFallback ? (
          <div className="error preparation-fallback" role="alert">
            <p>{t(preparationFallback.code === "multiple-caches"
              ? preparationFallback.fileCount > 1 ? "workspace.preparationMultipleCachesMultiple" : "workspace.preparationMultipleCaches"
              : preparationFallback.fileCount > 1 ? "workspace.preparationOperationalFallbackMultiple" : "workspace.preparationOperationalFallback")}</p>
            <div className="preparation-controls">
              <button className="secondary-action" type="button" onClick={() => finishOriginalFallback(true)}>{t("workspace.sendOriginal")}</button>
              <button className="ghost-action" type="button" onClick={() => finishOriginalFallback(false)}>{t("workspace.cancelPreparation")}</button>
            </div>
          </div>
        ) : null}
        {preparationNotices.map((notice, index) => (
          <div className="status preparation-notice" role="status" key={`${notice.original.name}-${index}`}>
            <strong>{t("workspace.preparationReady")}</strong>
            <span>{t("workspace.preparationSize", {
              original: formatFileSize(notice.originalSize, locale),
              prepared: formatFileSize(notice.preparedSize, locale),
            })}</span>
            <small>{t("workspace.preparationNotice")}</small>
          </div>
        ))}
        {error ? <div className="error" role="alert">{error}</div> : null}
        {report && activeTab === "overview" ? (
          <Overview
            report={report}
            onAnalyze={handleAnalyze}
            onClose={handleCloseAnalysis}
            onExport={handleExport}
            loading={loading}
            exporting={exporting}
            disabled={isBusy}
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
              disabled={isBusy}
              error={compareError}
              onBaseFileChange={handleCompareBaseFileChange}
              onNewFileChange={handleCompareNewFileChange}
              onResultChange={setCompareResult}
              onLoadingChange={setCompareLoading}
              onErrorChange={setCompareError}
              onClear={handleClearComparison}
              onCompare={handleCompareUpload}
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
