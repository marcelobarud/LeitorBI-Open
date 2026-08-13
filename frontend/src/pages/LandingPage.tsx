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
import { PBI_MODEL_EXPORT_URL, TABULAR_EDITOR_URL, TechnicalLink } from "../components/TechnicalLink";

export function LandingPage({ onStart }: { onStart: () => void }) {
  const { t } = useLocale();
  const exportDescription = t("landing.exportModelDescription");
  const [exportDescriptionBeforeTabular, exportDescriptionAfterTabular] = exportDescription.split("Tabular Editor");
  const [exportDescriptionBeforeScript, exportDescriptionAfterScript] = exportDescriptionAfterTabular.split("PBIModelExport");

  return (
    <main className="landing-page">
      <header className="landing-topbar">
        <div className="brand">
          <span className="brand-mark">LB</span>
          <span>{t("common.productName")}</span>
        </div>
        <div className="landing-access">
          <button className="ghost-action" type="button" onClick={onStart}>
            <PlayCircle size={18} />
            {t("landing.startNow")}
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <aside className="landing-index" aria-label="Índice do LeitorBI Open">
          <strong>{t("common.productName")}</strong>
          <ol>
            <li><span className="benefit-marker" aria-hidden="true" />{t("landing.objectiveAudit")}</li>
            <li><span className="benefit-marker" aria-hidden="true" />{t("landing.visualComparison")}</li>
            <li><span className="benefit-marker" aria-hidden="true" />{t("landing.sharedDelivery")}</li>
          </ol>
          <div className="index-stamp">LeitorBI<br />Open</div>
        </aside>
        <div className="landing-copy">
          <h1>{t("landing.hero")}</h1>
          <p>{t("landing.heroDescription")}</p>
          <div className="cover-record">
            <span>Análise Técnica</span>
            <strong>Tenha controle do seu modelo · leitura técnica e rastreável.</strong>
          </div>
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

      <section className="landing-insights landing-ledger" aria-label={t("landing.highlights")}>
        <article className="insight-card good"><ShieldCheck size={22} /><div><span>{t("landing.objectiveAudit")}</span><strong>{t("landing.inventoryMinutes")}</strong><p>{t("landing.auditDescription")}</p></div></article>
        <article className="insight-card"><GitCompareArrows size={22} /><div><span>{t("landing.visualComparison")}</span><strong>{t("landing.changesBetween")}</strong><p>{t("landing.changesDescription")}</p></div></article>
        <article className="insight-card warn"><Download size={22} /><div><span>{t("landing.sharedDelivery")}</span><strong>{t("landing.excelReady")}</strong><p>{t("landing.excelDescription")}</p></div></article>
      </section>

      <section className="landing-steps" id="como-usar">
        <header className="page-header"><ClipboardList size={22} /><div><h2>{t("landing.howToStart")}</h2><p>{t("landing.workflowDescription")}</p></div></header>
        <div>
          <article><span>1</span><strong>{t("landing.exportModel")}</strong><p>{exportDescriptionBeforeTabular}<TechnicalLink href={TABULAR_EDITOR_URL}>Tabular Editor</TechnicalLink>{exportDescriptionBeforeScript}<TechnicalLink href={PBI_MODEL_EXPORT_URL}>PBIModelExport</TechnicalLink>{exportDescriptionAfterScript}</p></article>
          <article><span>2</span><strong>{t("landing.startLeitorBI")}</strong><p>{t("landing.startDescription")}</p></article>
          <article><span>3</span><strong>{t("landing.uploadFilterShare")}</strong><p>{t("landing.uploadFilterShareDescription")}</p></article>
        </div>
      </section>
    </main>
  );
}
