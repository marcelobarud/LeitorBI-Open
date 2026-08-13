import { useLocale } from "../i18n/LocaleProvider";

type BrandVariant = "landing" | "sidebar";

type BrandProps = {
  variant?: BrandVariant;
  className?: string;
  onClick?: () => void;
};

export function Brand({ variant = "landing", className = "", onClick }: BrandProps) {
  const { t } = useLocale();
  const classes = ["brand", `brand--${variant}`, className].filter(Boolean).join(" ");
  const content = (
    <>
      <span className="brand-mark" aria-hidden="true">LB</span>
      <span>{t("common.productName")}</span>
    </>
  );

  if (onClick) {
    return (
      <button className={`${classes} brand-button`} type="button" onClick={onClick} aria-label={t("common.backToLanding")}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
