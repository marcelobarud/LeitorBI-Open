import type { ReactNode } from "react";

export const TABULAR_EDITOR_URL = "https://github.com/TabularEditor/TabularEditor/releases/latest";
export const PBI_MODEL_EXPORT_URL = "https://github.com/hihipy/pbi-model-export/blob/main/PBIModelExport.csx";

export function TechnicalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="technical-link" href={href} target="_blank" rel="noopener noreferrer">
      <strong>{children}</strong>
    </a>
  );
}
