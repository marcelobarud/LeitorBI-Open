import { BlobReader, BlobWriter, TextReader, TextWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inspectZipEntries,
  isPbipCachePath,
  MAX_PBIP_FILES,
  MAX_PBIP_PATH_DEPTH,
  MAX_PBIP_UNCOMPRESSED_BYTES,
  ModelPreparationError,
  prepareModelUpload,
} from "./preparation";
import { preparePbipZip } from "./zipProcessor";

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

afterEach(() => vi.unstubAllGlobals());

function entry(filename: string, overrides: Partial<Parameters<typeof inspectZipEntries>[1][number]> = {}) {
  return {
    filename,
    directory: false,
    compressedSize: 1,
    uncompressedSize: 1,
    ...overrides,
  };
}

async function createZip(files: ReadonlyArray<readonly [string, string]>) {
  const output = new BlobWriter("application/zip");
  const writer = new ZipWriter(output, { useWebWorkers: false });
  for (const [name, content] of files) await writer.add(name, new TextReader(content));
  await writer.close();
  return output.getData();
}

async function readZipContents(blob: Blob) {
  const reader = new ZipReader(new BlobReader(blob), { useWebWorkers: false });
  try {
    const entries = await reader.getEntries();
    const contents = new Map<string, string>();
    for (const item of entries) {
      if (!item.directory) contents.set(item.filename, await item.getData(new TextWriter()));
    }
    return contents;
  } finally {
    await reader.close();
  }
}

function hashContent(value: string) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

describe("PBIP upload preparation metadata", () => {
  it("recognizes only the exact case-sensitive trailing .pbi/cache.abf path", () => {
    expect(isPbipCachePath(".pbi/cache.abf")).toBe(true);
    expect(isPbipCachePath("Model.SemanticModel/.pbi/cache.abf")).toBe(true);
    expect(isPbipCachePath("Model.SemanticModel\\.pbi\\cache.abf")).toBe(true);
    for (const name of [".pbi/CACHE.ABF", "folder/cache.abf", "my-cache.abf", "cache.abf.bak", ".pbi/cache.abf/other"]) {
      expect(isPbipCachePath(name)).toBe(false);
    }
  });

  it("returns unchanged when no exact cache entry exists", () => {
    expect(inspectZipEntries(20, [entry("model.bim")])).toEqual({ status: "unchanged" });
    expect(inspectZipEntries(20, [entry(".pbi/CACHE.ABF")])).toEqual({ status: "unchanged" });
    expect(inspectZipEntries(20, [entry("folder/cache.abf")])).toEqual({ status: "unchanged" });
  });

  it("allows a compressed entry to expand beyond the ZIP's compressed size within the declared total limit", () => {
    expect(inspectZipEntries(10, [entry(".pbi/cache.abf", { compressedSize: 8, uncompressedSize: 20 })]))
      .toEqual({ status: "cache-found" });
  });

  it("requires explicit original-file fallback for multiple cache entries", () => {
    expect(inspectZipEntries(20, [entry(".pbi/cache.abf"), entry("Model.SemanticModel/.pbi/cache.abf")]))
      .toEqual({ status: "multiple-caches" });
  });

  it.each(["../outside.txt", "folder/../../outside.txt", "/absolute.txt", "C:/absolute.txt", "folder\u0000name"])(
    "blocks unsafe ZIP path %j",
    (filename) => {
      expect(() => inspectZipEntries(20, [entry(filename)])).toThrowError(ModelPreparationError);
    },
  );

  it("blocks normalized duplicates, symlinks, nested archives and declared-limit violations including cache", () => {
    expect(() => inspectZipEntries(20, [entry("folder/name.txt"), entry("folder\\name.txt")]))
      .toThrowError(ModelPreparationError);
    expect(() => inspectZipEntries(20, [entry("link", { unixExternalUpper: 0o120777 })]))
      .toThrowError(ModelPreparationError);
    expect(() => inspectZipEntries(20, [entry("folder/embedded.zip")])).toThrowError(ModelPreparationError);
    expect(() => inspectZipEntries(20, [entry(".pbi/cache.abf", { uncompressedSize: MAX_PBIP_UNCOMPRESSED_BYTES + 1 })]))
      .toThrowError(ModelPreparationError);
    expect(() => inspectZipEntries(20, Array.from({ length: MAX_PBIP_FILES + 1 }, (_, i) => entry(`f${i}`))))
      .toThrowError(ModelPreparationError);
    const deepPath = `${Array.from({ length: MAX_PBIP_PATH_DEPTH }, () => "a").join("/")}/f`;
    expect(() => inspectZipEntries(20, [entry(deepPath)])).toThrowError(ModelPreparationError);
  });
});

describe("PBIP ZIP transformation", () => {
  it("removes only the unique cache and preserves every other file's content hash", async () => {
    const originalContents = [
      ["A.txt", "alpha"],
      ["B.txt", "beta"],
      ["Model.SemanticModel/.pbi/cache.abf", "cache fixture bytes"],
      ["C.txt", "gamma"],
    ] as const;
    const original = await createZip([...originalContents]);
    const result = await preparePbipZip(original);
    expect(result.status).toBe("prepared");
    if (result.status !== "prepared") return;

    const originalFiles = await readZipContents(original);
    const preparedFiles = await readZipContents(result.blob);
    expect(Array.from(preparedFiles.keys())).toEqual(["A.txt", "B.txt", "C.txt"]);
    for (const name of ["A.txt", "B.txt", "C.txt"]) {
      expect(hashContent(preparedFiles.get(name)!)).toBe(hashContent(originalFiles.get(name)!));
    }
    expect(originalFiles.has("Model.SemanticModel/.pbi/cache.abf")).toBe(true);
    expect(result.blob.size).toBeLessThan(original.size);
  });

  it("preserves lookalike cache names instead of filtering them", async () => {
    const original = await createZip([
      [".pbi/CACHE.ABF", "upper"],
      ["folder/cache.abf", "nested"],
      ["cache.abf.bak", "backup"],
    ]);
    const result = await preparePbipZip(original);
    expect(result).toEqual({ status: "unchanged" });
  });

  it("asks for explicit fallback on multiple exact cache paths", async () => {
    const original = await createZip([[".pbi/cache.abf", "one"], ["Model.SemanticModel/.pbi/cache.abf", "two"]]);
    expect(await preparePbipZip(original)).toEqual({ status: "multiple-caches" });
  });
});

describe("preparation worker lifecycle", () => {
  it("reuses the original when the worker finds no cache and skips JSON entirely", async () => {
    const worker = new MockWorker();
    worker.postMessage.mockImplementation(() => worker.onmessage?.({
      data: { ok: true, result: { status: "unchanged" } },
    } as MessageEvent));
    const WorkerMock = vi.fn(function WorkerMock() { return worker; });
    vi.stubGlobal("Worker", WorkerMock);
    const zip = new File(["zip"], "model.zip", { type: "application/zip" });
    const unchanged = await prepareModelUpload(zip);
    expect(unchanged.file).toBe(zip);
    expect(unchanged.inspected).toBe(true);
    expect(worker.terminate).toHaveBeenCalledOnce();

    const json = new File(["{}"], "model.json", { type: "application/json" });
    expect((await prepareModelUpload(json)).file).toBe(json);
    expect(WorkerMock).toHaveBeenCalledOnce();
  });

  it("returns an operational error for an unexpected worker failure", async () => {
    const worker = new MockWorker();
    const WorkerMock = vi.fn(function WorkerMock() { return worker; });
    vi.stubGlobal("Worker", WorkerMock);
    const pending = prepareModelUpload(new File(["zip"], "model.zip"));
    worker.onerror?.();
    await expect(pending).rejects.toMatchObject({ code: "operational" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("rejects unknown worker responses and terminates the worker", async () => {
    const worker = new MockWorker();
    worker.postMessage.mockImplementation(() => worker.onmessage?.({
      data: { ok: true, result: { status: "unexpected" } },
    } as MessageEvent));
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() { return worker; }));
    await expect(prepareModelUpload(new File(["zip"], "model.zip")))
      .rejects.toMatchObject({ code: "operational" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates the worker when posting the selected file fails", async () => {
    const worker = new MockWorker();
    worker.postMessage.mockImplementation(() => { throw new DOMException("DataCloneError"); });
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() { return worker; }));
    await expect(prepareModelUpload(new File(["zip"], "model.zip")))
      .rejects.toMatchObject({ code: "operational" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates the worker on cancel and never resolves as an uploadable file", async () => {
    const worker = new MockWorker();
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() { return worker; }));
    const controller = new AbortController();
    const pending = prepareModelUpload(new File(["zip"], "model.zip"), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
