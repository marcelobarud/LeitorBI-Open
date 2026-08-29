import { FileJson } from "lucide-react";
import { useLocale } from "../i18n/LocaleProvider";

type CompareFileInputProps = {
  label: string;
  file: File | null;
  onChange: (file: File) => void;
};

export function CompareFileInput({ label, file, onChange }: CompareFileInputProps) {
  const { t } = useLocale();
  return (
    <label className="compare-file">
      <FileJson size={28} />
      <span>{label}</span>
      <strong>{file ? file.name : t("comparison.selectFile")}</strong>
      <input
        type="file"
        accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) onChange(selected);
        }}
      />
    </label>
  );
}
