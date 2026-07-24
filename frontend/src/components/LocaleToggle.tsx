import { useLocale } from "../i18n/LocaleProvider";

export function LocaleToggle() {
  const { locale, toggleLocale, t } = useLocale();
  return <button className="ghost-action locale-toggle" type="button" onClick={toggleLocale} aria-label={t("language.switch")} title={t("language.switch")}><span aria-hidden="true" className={`locale-flag ${locale === "pt-BR" ? "br" : "us"}`} /></button>;
}
