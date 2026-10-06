import {
  BlobReader,
  BlobWriter,
  ERR_AMBIGUOUS_ARCHIVE,
  ERR_BAD_FORMAT,
  ERR_CENTRAL_DIRECTORY_NOT_FOUND,
  ERR_ENCRYPTED_CENTRAL_DIRECTORY,
  ERR_ENTRY_DATA_OUT_OF_BOUNDS,
  ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND,
  ERR_EOCDR_NOT_FOUND,
  ERR_EXTRAFIELD_ZIP64_NOT_FOUND,
  ERR_LOCAL_FILE_HEADER_NOT_FOUND,
  ERR_OVERLAPPING_ENTRY,
  ERR_UNSAFE_FILENAME,
  ZipReader,
  ZipWriter,
  WARNING_DUPLICATE_FILENAME,
  WARNING_MALFORMED_EXTRA_FIELD,
  WARNING_MISMATCHED_CENTRAL_DIRECTORY_OFFSET,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_BIT_FLAG,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_COMPRESSION_METHOD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_CRC32_OR_SIZES,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_FILENAME,
  WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
  WARNING_MISSING_ZIP64_EXTRA_FIELD,
  WARNING_PREPENDED_CENTRAL_DIRECTORY,
  WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
} from "@zip.js/zip.js";
import {
  inspectZipEntries,
  isPbipCachePath,
  ModelPreparationError,
  type PreparationResult,
  type ZipEntryMetadata,
} from "./preparation";

const unsafeWarnings = new Set([
  WARNING_DUPLICATE_FILENAME,
  WARNING_MALFORMED_EXTRA_FIELD,
  WARNING_MISMATCHED_CENTRAL_DIRECTORY_OFFSET,
  WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
  WARNING_MISSING_ZIP64_EXTRA_FIELD,
  WARNING_PREPENDED_CENTRAL_DIRECTORY,
  WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
]);
const unsafeEntryWarnings = new Set([
  WARNING_MALFORMED_EXTRA_FIELD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_BIT_FLAG,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_COMPRESSION_METHOD,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_CRC32_OR_SIZES,
  WARNING_MISMATCHED_LOCAL_FILE_HEADER_FILENAME,
]);
const malformedZipErrors = new Set([
  ERR_AMBIGUOUS_ARCHIVE,
  ERR_BAD_FORMAT,
  ERR_CENTRAL_DIRECTORY_NOT_FOUND,
  ERR_ENCRYPTED_CENTRAL_DIRECTORY,
  ERR_ENTRY_DATA_OUT_OF_BOUNDS,
  ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND,
  ERR_EOCDR_NOT_FOUND,
  ERR_EXTRAFIELD_ZIP64_NOT_FOUND,
  ERR_LOCAL_FILE_HEADER_NOT_FOUND,
  ERR_OVERLAPPING_ENTRY,
  ERR_UNSAFE_FILENAME,
]);

export async function preparePbipZip(
  file: Blob & { size: number },
): Promise<Exclude<PreparationResult, { status: "cache-found" }> | { status: "prepared"; blob: Blob }> {
  const reader = new ZipReader(new BlobReader(file), {
    useWebWorkers: false,
    strictness: "balanced",
    filenameValidation: "tolerant",
  });
  try {
    const entries = await reader.getEntries({ filenameValidation: "tolerant" });
    if (reader.warnings?.some((warning) => unsafeWarnings.has(warning.reason))) {
      throw new ModelPreparationError("unsafe");
    }
    if (entries.some((entry) => entry.warnings?.some((warning) => unsafeEntryWarnings.has(warning.reason)))) {
      throw new ModelPreparationError("unsafe");
    }

    const metadata: ZipEntryMetadata[] = entries.map((entry) => ({
      filename: entry.filename,
      directory: entry.directory,
      uncompressedSize: entry.uncompressedSize,
      compressedSize: entry.compressedSize,
      unixExternalUpper: entry.unixExternalUpper,
    }));
    const inspection = inspectZipEntries(file.size, metadata);
    if (inspection.status !== "cache-found") return inspection;

    const output = new BlobWriter("application/zip");
    const writer = new ZipWriter(output, { useWebWorkers: false });
    await writer.appendZip(new BlobReader(file), {
      readerOptions: {
        useWebWorkers: false,
        strictness: "balanced",
        filenameValidation: "tolerant",
      },
      filter: (entry) => !isPbipCachePath(entry.filename),
    });
    await writer.close();
    return { status: "prepared", blob: await output.getData() };
  } catch (error) {
    if (error instanceof ModelPreparationError) throw error;
    if (error instanceof Error && malformedZipErrors.has(error.message)) {
      throw new ModelPreparationError("unsafe");
    }
    throw new ModelPreparationError("operational");
  } finally {
    await reader.close();
  }
}
