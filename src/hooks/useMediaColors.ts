import { useEffect, useState } from "react";
import type { ColorName, MediaItem } from "@/types/media";
import { getMediaColor } from "@/lib/color";

type ColorMap = Record<string, ColorName | null>;

const idle: (cb: () => void) => void =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 500 })
    : (cb) => window.setTimeout(cb, 0);

/**
 * Lazily extracts a dominant color for every item (image or video frame) so
 * the UI can offer a "filter by color" control. Runs client-side via
 * <canvas>; results are cached in lib/color.ts, which also dedupes
 * concurrent requests for the same src, so it's safe to re-request on every
 * effect run (e.g. React StrictMode's dev-only double-invoke) without
 * re-doing the actual extraction work.
 */
export function useMediaColors(items: MediaItem[]): ColorMap {
  const [colors, setColors] = useState<ColorMap>({});

  useEffect(() => {
    let cancelled = false;

    items.forEach((item) => {
      const { type } = item;
      if (type === "pdf") return;
      idle(() => {
        if (cancelled) return;
        getMediaColor(item.src, type).then((color) => {
          if (cancelled) return;
          setColors((prev) =>
            prev[item.id] === color ? prev : { ...prev, [item.id]: color },
          );
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [items]);

  return colors;
}
