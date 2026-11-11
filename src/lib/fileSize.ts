const cache = new Map<string, number | null>();
const inFlight = new Map<string, Promise<number | null>>();

/**
 * Lazily reads a file's byte size via a HEAD request's Content-Length —
 * for bundled assets, which don't carry size metadata at build time.
 * Imported items already know their size (blob.size), so this is only
 * needed for filesystem-origin items. Cached and deduped like getMediaColor.
 */
export function getMediaSize(src: string): Promise<number | null> {
  if (cache.has(src)) return Promise.resolve(cache.get(src) ?? null);
  const existing = inFlight.get(src);
  if (existing) return existing;

  const task = fetch(src, { method: "HEAD" })
    .then((res) => {
      const len = res.headers.get("content-length");
      if (len) return Number(len);
      // Some dev servers omit Content-Length on HEAD — fall back to a real fetch.
      return fetch(src)
        .then((r) => r.blob())
        .then((blob) => blob.size);
    })
    .catch(() => null)
    .then((size) => {
      cache.set(src, size);
      inFlight.delete(src);
      return size;
    });

  inFlight.set(src, task);
  return task;
}
