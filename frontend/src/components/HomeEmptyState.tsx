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
          <p>{t("workspace.homeDescriptionModels")}</p>
        </div>
      </header>

      <section className="empty-workspace">
        <h1>{t("workspace.noFile")}</h1>
        <p>{t("workspace.noFileDescriptionModels")}</p>

        <button
          className="empty-drop-hint"
          type="button"
          onClick={onOpenFilePicker}
          disabled={disabled}
          aria-label={t("workspace.uploadAriaModel")}
        >
          <FileJson size={34} />
          <strong>{disabled ? t("workspace.analyzingFile") : t("workspace.selectModelFile")}</strong>
          <span>{selectedFileLabel || t("workspace.fileLimitModels")}</span>
        </button>

        <div className="upload-rules">
          <span>{t("workspace.acceptedFormatsModels")}</span>
          <span>{t("workspace.fileSizeLimitModels")}</span>
          <span>{t("workspace.realDataNotice")}</span>
          <span>{t("workspace.coldStartNotice")}</span>
        </div>
      </section>
    </div>
  );
}
