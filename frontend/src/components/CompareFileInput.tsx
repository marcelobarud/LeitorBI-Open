import { FileJson } from "lucide-react";

type CompareFileInputProps = {
  label: string;
  file: File | null;
  onChange: (file: File) => void;
};

export function CompareFileInput({ label, file, onChange }: CompareFileInputProps) {
  return (
    <label className="compare-file">
      <FileJson size={28} />
      <span>{label}</span>
      <strong>{file ? file.name : "Selecionar JSON"}</strong>
      <input
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) onChange(selected);
        }}
      />
    </label>
  );
}
