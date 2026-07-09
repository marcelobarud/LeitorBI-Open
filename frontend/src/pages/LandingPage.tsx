import {
  BookOpenCheck,
  ClipboardList,
  Database,
  Download,
  GitCompareArrows,
  KeyRound,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { LoginPopover } from "../components/LoginPopover";
import { ROUTES } from "../routes";

type LandingPageProps = {
  loading: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
};

export function LandingPage({ loading, error, onLogin, onRegister }: LandingPageProps) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <main className="landing-page">
      <header className="landing-topbar">
        <div className="brand">
          <Database size={24} />
          <span>LeitorBI</span>
        </div>
        <div className="landing-access">
          <button
            className="ghost-action"
            type="button"
            onClick={() => setShowLogin((current) => !current)}
          >
            <KeyRound size={18} />
            Acessar app
          </button>
          {showLogin ? <LoginPopover loading={loading} error={error} onLogin={onLogin} onRegister={onRegister} /> : null}
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">LeitorBI Web</span>
          <h1>Leia modelos Power BI com clareza antes de decidir, auditar ou apresentar.</h1>
          <p>
            Uma ferramenta para transformar exports JSON do modelo em inventario visual, filtros de analise,
            comparacao entre versoes e entrega em Excel para o time.
          </p>
          <div className="hero-actions">
            <button
              className="primary-action"
              type="button"
              onClick={() => setShowLogin(true)}
            >
              <KeyRound size={18} />
              Entrar agora
            </button>
            <a className="secondary-action" href="#como-usar">
              <BookOpenCheck size={18} />
              Como usar
            </a>
            <a className="ghost-action" href={ROUTES.demo}>
              <PlayCircle size={18} />
              Ver demonstracao
            </a>
          </div>
        </div>

        <div className="landing-preview" aria-hidden="true">
          <div className="preview-sidebar">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="preview-header">
              <span>Modelo carregado</span>
              <strong>Comercial Executivo</strong>
            </div>
            <div className="preview-metrics">
              <div>
                <span>Tabelas</span>
                <strong>18</strong>
              </div>
              <div>
                <span>Medidas</span>
                <strong>64</strong>
              </div>
              <div>
                <span>Fontes</span>
                <strong>5</strong>
              </div>
            </div>
            <div className="preview-table">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-insights" aria-label="Destaques">
        <article className="insight-card good">
          <ShieldCheck size={22} />
          <div>
            <span>Auditoria objetiva</span>
            <strong>Inventario do modelo em minutos</strong>
            <p>Tabelas, colunas, medidas, fontes e relacionamentos organizados para revisao tecnica.</p>
          </div>
        </article>
        <article className="insight-card">
          <GitCompareArrows size={22} />
          <div>
            <span>Comparacao visual</span>
            <strong>Mudancas entre dois exports</strong>
            <p>Veja itens adicionados, removidos e modificados antes de publicar novas versoes.</p>
          </div>
        </article>
        <article className="insight-card warn">
          <Download size={22} />
          <div>
            <span>Entrega compartilhavel</span>
            <strong>Exportacao pronta para Excel</strong>
            <p>Leve a analise para reunioes, documentacao ou revisoes com stakeholders.</p>
          </div>
        </article>
      </section>

      <section className="landing-steps" id="como-usar">
        <header className="page-header">
          <ClipboardList size={22} />
          <div>
            <h2>Como comecar</h2>
            <p>O fluxo basico para sair do Power BI e chegar na analise navegavel.</p>
          </div>
        </header>
        <div>
          <article>
            <span>1</span>
            <strong>Exporte o modelo</strong>
            <p>Abra o PBIX no Power BI, conecte o Tabular Editor e gere o JSON do modelo.</p>
          </article>
          <article>
            <span>2</span>
            <strong>Entre no LeitorBI</strong>
            <p>Use a area de acesso desta pagina para abrir o ambiente de analise.</p>
          </article>
          <article>
            <span>3</span>
            <strong>Carregue, filtre e compartilhe</strong>
            <p>Envie o JSON, navegue pelas abas, compare versoes e exporte a leitura em Excel.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
