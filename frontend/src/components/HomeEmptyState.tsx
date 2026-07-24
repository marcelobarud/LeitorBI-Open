import { FileJson } from "lucide-react";
import { useLocale } from "../i18n/LocaleProvider";

type HomeEmptyStateProps = {
  onOpenFilePicker: () => void;
  disabled: boolean;
  selectedFileLabel: string;
};

export function HomeEmptyState({ onOpenFilePicker, disabled, selectedFileLabel }: HomeEmptyStateProps) {
  const { t } = useLocale();
  return (
    <div className="home-empty-page">
      <header className="page-header">
        <FileJson size={22} />
        <div>
          <h2>{t("nav.home")}</h2>
          <p>{t("workspace.homeDescription")}</p>
        </div>
      </header>

      <section className="empty-workspace">
        <h1>{t("workspace.noFile")}</h1>
        <p>{t("workspace.noFileDescription")}</p>

        <button
          className="empty-drop-hint"
          type="button"
          onClick={onOpenFilePicker}
          disabled={disabled}
          aria-label={t("workspace.uploadAria")}
        >
          <FileJson size={34} />
          <strong>{disabled ? t("workspace.analyzingFile") : t("workspace.selectModelJson")}</strong>
          <span>{selectedFileLabel || t("workspace.fileLimit")}</span>
        </button>

        <div className="upload-rules">
          <span>{t("workspace.acceptedFormat")}</span>
          <span>{t("workspace.fileSizeLimit")}</span>
          <span>{t("workspace.realDataNotice")}</span>
        </div>
      </section>
    </div>
  );
}
