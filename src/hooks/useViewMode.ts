import { useCallback, useEffect, useState } from "react";

export type ViewMode = "grid" | "list";

const STORAGE_KEY = "media-gallery:view-mode";

function loadViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  return window.localStorage.getItem(STORAGE_KEY) === "grid" ? "grid" : "list";
}

/** Grid/list display preference, persisted like a real file manager remembers it. */
export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      // Storage unavailable — the preference just won't persist across reloads.
    }
  }, [viewMode]);

  const setViewMode = useCallback(
    (mode: ViewMode) => setViewModeState(mode),
    [],
  );

  return [viewMode, setViewMode] as const;
}
