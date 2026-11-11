import {
  deleteImportedRecord,
  getAllImportedRecords,
} from "@/lib/importedMediaDb";
import { uploadMedia } from "@/lib/api/media";

const MIGRATION_FLAG_KEY = "media-gallery:migrated-to-server:v1";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

const FALLBACK_EXTENSION_BY_TYPE: Record<string, string> = {
  image: "png",
  video: "mp4",
  pdf: "pdf",
};

function extensionFor(mimeType: string, type: string): string {
  return (
    EXTENSION_BY_MIME[mimeType] ?? FALLBACK_EXTENSION_BY_TYPE[type] ?? "bin"
  );
}

async function runMigration(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;

  const records = await getAllImportedRecords();
  for (const record of records) {
    const ext = extensionFor(record.blob.type, record.type);
    await uploadMedia(
      record.category,
      record.type,
      `${record.title}.${ext}`,
      record.blob,
      record.id,
    );
    await deleteImportedRecord(record.id);
  }
  localStorage.setItem(MIGRATION_FLAG_KEY, "done");
}

let migrationPromise: Promise<void> | null = null;

/**
 * One-time migration: before this change, every imported/edited file's bytes
 * lived only in this browser's IndexedDB (lib/importedMediaDb.ts). Now they're
 * uploaded to the server instead (lib/api/media.ts), so anything still sitting
 * in IndexedDB gets re-uploaded and cleared out here, keeping the same id so
 * every module's stored mediaItemId/attachmentIds references keep resolving
 * to the same item. Cached in a module-level promise so React mounting
 * useImportedMedia's effect twice (StrictMode) doesn't race and double-upload.
 */
export function migrateImportedMedia(): Promise<void> {
  if (!migrationPromise) migrationPromise = runMigration();
  return migrationPromise;
}
