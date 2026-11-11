import type { MediaType } from "@/types/media";

// Legacy client-only storage for imported media, from before file bytes moved
// to the server (see lib/api/media.ts). Only read from here now — by
// migrateImportedMedia.ts's one-time migration — to pick up anything a
// browser still has left over from before that change.
export interface ImportedRecord {
  id: string;
  type: MediaType;
  title: string;
  /** Initial category assigned at import time; folder/category moves after that live in useOrganization's own storage. */
  category: string;
  blob: Blob;
  createdAt: number;
}

const DB_NAME = "media-gallery-imports";
const STORE = "files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Removes an imported file's bytes for good — there's no other copy to fall back to. */
export async function deleteImportedRecord(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAllImportedRecords(): Promise<ImportedRecord[]> {
  const db = await openDb();
  const records = await new Promise<ImportedRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as ImportedRecord[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return records;
}
