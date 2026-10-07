import type { TranslationKey } from "../i18n/types";

export const MAX_JSON_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PBIP_UPLOAD_BYTES = 100 * 1024 * 1024;

export function validateModelFile(
  file: File,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string | null {
  const filename = file.name.toLowerCase();
  const isJson = filename.endsWith(".json");
  const isZip = filename.endsWith(".zip");
  const isJsonType = !file.type || file.type === "application/json";
  const isZipType = !file.type || ["application/zip", "application/x-zip-compressed"].includes(file.type);
  if ((!isJson || !isJsonType) && (!isZip || !isZipType)) return t("workspace.invalidModelFile");
  if (isJson && file.size > MAX_JSON_UPLOAD_BYTES) return t("workspace.jsonUploadTooLarge");
  if (isZip && file.size > MAX_PBIP_UPLOAD_BYTES) return t("workspace.pbipUploadTooLarge");
  return null;
}
