export const MAX_PBIP_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_PBIP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_PBIP_FILES = 5000;
export const MAX_PBIP_PATH_DEPTH = 20;
const NESTED_ARCHIVE_SUFFIXES = new Set([".7z", ".gz", ".rar", ".tar", ".tgz", ".zip"]);

export type PreparationErrorCode = "unsafe" | "operational" | "multiple-caches";

export type PreparedModelUpload = {
  original: File;
  file: File;
  inspected: boolean;
  cacheRemoved: boolean;
  originalSize: number;
  preparedSize: number;
};

export type PreparationResult =
  | { status: "unchanged" }
  | { status: "multiple-caches" }
  | { status: "cache-found" };

export type ZipEntryMetadata = {
  filename: string;
  directory: boolean;
  uncompressedSize: number;
  compressedSize: number;
  unixExternalUpper?: number;
};

export class ModelPreparationError extends Error {
  constructor(readonly code: PreparationErrorCode) {
    super(code);
    this.name = "ModelPreparationError";
  }
}

function normalizedPath(name: string): string {
  const parts = name.replace(/\\/g, "/").split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") throw new ModelPreparationError("unsafe");
    normalized.push(part);
  }
  return normalized.join("/") || ".";
}

export function isPbipCachePath(name: string): boolean {
  const normalized = normalizedPath(name);
  const parts = normalized.split("/");
  return parts.length >= 2 && parts[parts.length - 2] === ".pbi" && parts[parts.length - 1] === "cache.abf";
}

export function inspectZipEntries(fileSize: number, entries: ZipEntryMetadata[]): PreparationResult {
  if (!Number.isSafeInteger(fileSize) || fileSize < 0 || fileSize > MAX_PBIP_UPLOAD_BYTES) {
    throw new ModelPreparationError("unsafe");
  }
  if (entries.length > MAX_PBIP_FILES) throw new ModelPreparationError("unsafe");

  let totalUncompressedSize = 0;
  const normalizedNames = new Set<string>();
  const cacheEntries: ZipEntryMetadata[] = [];

  for (const entry of entries) {
    const rawName = entry.filename;
    if (typeof rawName !== "string" || !rawName || rawName.includes("\0")) {
      throw new ModelPreparationError("unsafe");
    }
    const slashName = rawName.replace(/\\/g, "/");
    if (slashName.startsWith("/") || /^[A-Za-z]:\//.test(slashName)) {
      throw new ModelPreparationError("unsafe");
    }

    const normalized = normalizedPath(rawName);
    const depth = normalized === "." ? 1 : normalized.split("/").length;
    if (depth > MAX_PBIP_PATH_DEPTH) throw new ModelPreparationError("unsafe");
    if (normalizedNames.has(normalized)) throw new ModelPreparationError("unsafe");
    normalizedNames.add(normalized);

    if (!Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0 || entry.compressedSize > fileSize) {
      throw new ModelPreparationError("unsafe");
    }
    if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) {
      throw new ModelPreparationError("unsafe");
    }
    totalUncompressedSize += entry.uncompressedSize;
    if (totalUncompressedSize > MAX_PBIP_UNCOMPRESSED_BYTES) throw new ModelPreparationError("unsafe");

    const pathParts = normalized.split("/");
    const basename = pathParts[pathParts.length - 1] ?? "";
    const dot = basename.lastIndexOf(".");
    const suffix = dot > 0 ? basename.slice(dot).toLowerCase() : "";
    if (!entry.directory && NESTED_ARCHIVE_SUFFIXES.has(suffix)) {
      throw new ModelPreparationError("unsafe");
    }

    const unixType = ((entry.unixExternalUpper ?? 0) & 0o170000);
    if (unixType === 0o120000) throw new ModelPreparationError("unsafe");
    if (isPbipCachePath(normalized) && !entry.directory) cacheEntries.push(entry);
  }

  if (cacheEntries.length > 1) return { status: "multiple-caches" };
  if (cacheEntries.length === 0) return { status: "unchanged" };
  return { status: "cache-found" };
}

export async function prepareModelUpload(
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<PreparedModelUpload> {
  const isZip = file.name.toLowerCase().endsWith(".zip");
  if (!isZip) {
    return { original: file, file, inspected: false, cacheRemoved: false, originalSize: file.size, preparedSize: file.size };
  }
  if (file.size > MAX_PBIP_UPLOAD_BYTES) throw new ModelPreparationError("unsafe");

  const result = await runPreparationWorker(file, options.signal);
  if (result.status === "multiple-caches") throw new ModelPreparationError("multiple-caches");
  if (result.status === "unchanged") {
    return { original: file, file, inspected: true, cacheRemoved: false, originalSize: file.size, preparedSize: file.size };
  }

  const preparedFile = new File([result.blob], file.name, {
    type: file.type || "application/zip",
    lastModified: file.lastModified,
  });
  return {
    original: file,
    file: preparedFile,
    inspected: true,
    cacheRemoved: true,
    originalSize: file.size,
    preparedSize: preparedFile.size,
  };
}

type WorkerResult =
  | { status: "unchanged" }
  | { status: "multiple-caches" }
  | { status: "prepared"; blob: Blob };

function runPreparationWorker(file: File, signal?: AbortSignal): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(new URL("./preparation.worker.ts", import.meta.url), { type: "module" });
    } catch {
      reject(new ModelPreparationError("operational"));
      return;
    }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      callback();
    };
    const onAbort = () => finish(() => reject(new DOMException("Aborted", "AbortError")));
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as { ok?: unknown; result?: unknown; code?: unknown } | null;
      finish(() => {
        if (message?.ok === false) {
          const code = message.code;
          reject(new ModelPreparationError(
            code === "unsafe" || code === "multiple-caches" || code === "operational" ? code : "operational",
          ));
          return;
        }

        const result = message?.result as { status?: unknown; blob?: unknown } | null;
        if (message?.ok === true && result?.status === "unchanged") {
          resolve({ status: "unchanged" });
        } else if (message?.ok === true && result?.status === "multiple-caches") {
          resolve({ status: "multiple-caches" });
        } else if (message?.ok === true && result?.status === "prepared" && result.blob instanceof Blob) {
          resolve({ status: "prepared", blob: result.blob });
        } else {
          reject(new ModelPreparationError("operational"));
        }
      });
    };
    worker.onerror = () => finish(() => reject(new ModelPreparationError("operational")));
    worker.onmessageerror = () => finish(() => reject(new ModelPreparationError("operational")));
    try {
      worker.postMessage({ file });
    } catch {
      finish(() => reject(new ModelPreparationError("operational")));
    }
  });
}
