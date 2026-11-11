import { useCallback, useEffect, useState } from "react";
import type { MediaItem, MediaType } from "@/types/media";
import {
  deleteMedia,
  listMedia,
  mediaFileUrl,
  uploadMedia,
} from "@/lib/api/media";
import { migrateImportedMedia } from "@/lib/migrateImportedMedia";
import { classifyDroppedFiles, extractMediaFromZip } from "@/lib/zip";

export interface ImportZipOutcome {
  imported: number;
  items: MediaItem[];
  skipped: { filename: string; reason: string }[];
}

/** Exported so a restore can check a filename against existing titles before importing a duplicate. */
export function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return withoutExt
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Media that was imported from a .zip or dragged in directly, rather than
 * living in src/assets/. The file bytes are uploaded to the server (see
 * lib/api/media.ts) so they're durable across browsers/devices, not just this
 * one browser's storage. Where each item sits (category/folder) is tracked by
 * useOrganization, the same as for filesystem-origin media, so there's one
 * source of truth for that.
 */
export function useImportedMedia() {
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    migrateImportedMedia()
      .catch((err) => {
        console.error("Failed to migrate IndexedDB media to the server", err);
      })
      .then(() => listMedia())
      .then((records) => {
        if (cancelled) return;
        setItems(
          records.map((record) => ({
            id: record.id,
            type: record.type,
            title: record.title,
            category: record.category,
            src: mediaFileUrl(record.id),
            size: record.size,
            addedAt: record.createdAt,
          })),
        );
      })
      .catch((err) => {
        console.error("Failed to load uploaded media", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (
      category: string,
      blobs: { name: string; type: MediaType; blob: Blob }[],
    ) => {
      const newItems: MediaItem[] = [];
      for (const { name, type, blob } of blobs) {
        const record = await uploadMedia(category, type, name, blob);
        newItems.push({
          id: record.id,
          type: record.type,
          title: record.title,
          category: record.category,
          src: mediaFileUrl(record.id),
          size: record.size,
          addedAt: record.createdAt,
        });
      }
      if (newItems.length > 0) setItems((prev) => [...prev, ...newItems]);
      return newItems;
    },
    [],
  );

  const importZip = useCallback(
    async (category: string, file: File): Promise<ImportZipOutcome> => {
      const { files, skipped } = await extractMediaFromZip(file);
      const newItems = await persist(
        category,
        files.map((f) => ({ name: f.filename, type: f.type, blob: f.blob })),
      );
      return { imported: newItems.length, items: newItems, skipped };
    },
    [persist],
  );

  /** For a direct OS drag-and-drop of image/video files (not inside a zip). */
  const importFiles = useCallback(
    async (category: string, files: File[]): Promise<ImportZipOutcome> => {
      const { accepted, skipped } = classifyDroppedFiles(files);
      const newItems = await persist(
        category,
        accepted.map((f) => ({
          name: f.file.name,
          type: f.type,
          blob: f.file,
        })),
      );
      return { imported: newItems.length, items: newItems, skipped };
    },
    [persist],
  );

  /** Permanently removes an imported item — its bytes only ever lived on the server. */
  const deleteItem = useCallback(async (id: string) => {
    await deleteMedia(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { items, importZip, importFiles, deleteItem };
}
