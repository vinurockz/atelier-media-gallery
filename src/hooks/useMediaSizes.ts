import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "@/types/media";
import { getMediaSize } from "@/lib/fileSize";

type SizeMap = Record<string, number | null>;

const idle: (cb: () => void) => void =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 500 })
    : (cb) => window.setTimeout(cb, 0);

/**
 * File size per item: known immediately for imported items (item.size),
 * lazily fetched (and cached in lib/fileSize.ts) for bundled assets.
 */
export function useMediaSizes(items: MediaItem[]): SizeMap {
  const [fetched, setFetched] = useState<SizeMap>({});

  useEffect(() => {
    let cancelled = false;

    items.forEach((item) => {
      if (item.size !== undefined) return;
      idle(() => {
        if (cancelled) return;
        getMediaSize(item.src).then((size) => {
          if (cancelled) return;
          setFetched((prev) =>
            prev[item.id] === size ? prev : { ...prev, [item.id]: size },
          );
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [items]);

  return useMemo(() => {
    const merged: SizeMap = {};
    items.forEach((item) => {
      merged[item.id] = item.size ?? fetched[item.id] ?? null;
    });
    return merged;
  }, [items, fetched]);
}
