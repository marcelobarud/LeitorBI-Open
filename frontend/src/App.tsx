import {
  AlertTriangle,
  BookOpenCheck,
  ClipboardList,
  Database,
  Download,
  LogOut,
  Maximize2,
  Minimize2,
  FileJson,
  GitCompareArrows,
  PlayCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Table2,
  Trash2,
  UserPlus,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
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
import { CompareFileInput } from "./components/CompareFileInput";
import { DataTable } from "./components/DataTable";
import { CompareView } from "./components/CompareView";
import { CompareErrorBoundary } from "./components/CompareErrorBoundary";
import { HomeEmptyState } from "./components/HomeEmptyState";
import { UsersAdminView } from "./components/UsersAdminView";
import { Overview } from "./components/Overview";
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
  { key: "relationships", label: "Relações" },
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
      title: "Análise e exporte",
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
        if (active) setDemoError(err instanceof Error ? err.message : "Erro inesperado ao carregar demonstração.");
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
          <span>Demonstração pública em modo de leitura, usando apenas dados de exemplo.</span>
        </div>
      </aside>

      <section className="content">
        <header className="workspace-topbar demo-topbar">
          <div>
            <span>Demonstração pública</span>
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
          <span>Prévia somente para leitura. Para carregar JSON, exportar Excel ou comparar modelos, faça login no app.</span>
          <a className="ghost-action" href={ROUTES.landing}>
            Voltar ao início
          </a>
        </div>

        {demoLoading ? <div className="status">Carregando demonstração...</div> : null}
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
        if (active) setLoginError(err instanceof Error ? err.message : "Erro ao verificar sessão.");
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
      setLoginError(err instanceof Error ? err.message : "E-mail ou senha inválidos.");
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
    if (message.includes("Sessão expirada")) {
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
          <div className="status">Verificando sessão...</div>
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
        {loading ? <div className="status" role="status">Analisando modelo...</div> : null}
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
