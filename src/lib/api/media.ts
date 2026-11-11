import type { MediaType } from "@/types/media";
import { request } from "@/lib/api/request";

/** The server's metadata record for an uploaded file — never the bytes themselves. */
export interface MediaRecord {
  id: string;
  type: MediaType;
  title: string;
  category: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

export function listMedia(): Promise<MediaRecord[]> {
  return request<MediaRecord[]>("/media");
}

/**
 * Uploads a file's bytes to the server. `id` is only ever passed by the
 * one-time IndexedDB migration (migrateImportedMedia.ts), so a migrated item
 * keeps the id every other module's stored `mediaItemId`/`attachmentIds`
 * already point at — a fresh upload lets the server mint a new one.
 */
export async function uploadMedia(
  category: string,
  type: MediaType,
  name: string,
  blob: Blob,
  id?: string,
): Promise<MediaRecord> {
  const form = new FormData();
  if (id) form.append("id", id);
  form.append("title", name);
  form.append("category", category);
  form.append("type", type);
  form.append("file", blob, name);

  const res = await fetch("/api/media", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return res.json() as Promise<MediaRecord>;
}

export function deleteMedia(id: string): Promise<void> {
  return request<void>(`/media/${id}`, { method: "DELETE" });
}

/** The single place that builds a server-backed MediaItem.src from a record's id. */
export function mediaFileUrl(id: string): string {
  return `/api/media/${encodeURIComponent(id)}/file`;
}
