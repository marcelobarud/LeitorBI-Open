import {
  BookOpenCheck,
  ClipboardList,
  Database,
  Download,
  GitCompareArrows,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "../i18n/LocaleProvider";
import { ROUTES } from "../routes";

export function LandingPage({ onStart }: { onStart: () => void }) {
  const { t } = useLocale();

  return (
    <main className="landing-page">
      <header className="landing-topbar">
        <div className="brand"><Database size={24} /><span>LeitorBI-Web Open</span></div>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">{t("landing.product")}</span>
          <h1>{t("landing.hero")}</h1>
          <p>{t("landing.heroDescription")}</p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={onStart}>
              <PlayCircle size={18} />
              {t("landing.startNow")}
            </button>
            <a className="secondary-action" href="#como-usar">
              <BookOpenCheck size={18} />
              {t("landing.howItWorks")}
            </a>
            <a className="ghost-action" href={ROUTES.demo}>
              <PlayCircle size={18} />
              {t("landing.viewDemo")}
            </a>
          </div>
        </div>

        <div className="landing-preview" aria-hidden="true">
          <div className="preview-sidebar"><span /><span /><span /><span /></div>
          <div>
            <div className="preview-header"><span>{t("landing.previewModelLoaded")}</span><strong>Comercial Executivo</strong></div>
            <div className="preview-metrics">
              <div><span>{t("nav.tables")}</span><strong>18</strong></div>
              <div><span>{t("nav.measures")}</span><strong>64</strong></div>
              <div><span>{t("nav.sources")}</span><strong>5</strong></div>
            </div>
            <div className="preview-table"><span /><span /><span /><span /><span /><span /><span /></div>
          </div>
        </div>
      </section>

      <section className="landing-insights" aria-label={t("landing.highlights")}>
        <article className="insight-card good"><ShieldCheck size={22} /><div><span>{t("landing.objectiveAudit")}</span><strong>{t("landing.inventoryMinutes")}</strong><p>{t("landing.auditDescription")}</p></div></article>
        <article className="insight-card"><GitCompareArrows size={22} /><div><span>{t("landing.visualComparison")}</span><strong>{t("landing.changesBetween")}</strong><p>{t("landing.changesDescription")}</p></div></article>
        <article className="insight-card warn"><Download size={22} /><div><span>{t("landing.sharedDelivery")}</span><strong>{t("landing.excelReady")}</strong><p>{t("landing.excelDescription")}</p></div></article>
      </section>

      <section className="landing-steps" id="como-usar">
        <header className="page-header"><ClipboardList size={22} /><div><h2>{t("landing.howToStart")}</h2><p>{t("landing.workflowDescription")}</p></div></header>
        <div>
          <article><span>1</span><strong>{t("landing.exportModel")}</strong><p>{t("landing.exportModelDescription")}</p></article>
          <article><span>2</span><strong>{t("landing.startLeitorBI")}</strong><p>{t("landing.startDescription")}</p></article>
          <article><span>3</span><strong>{t("landing.uploadFilterShare")}</strong><p>{t("landing.uploadFilterShareDescription")}</p></article>
        </div>
      </section>
    </main>
  );
}
