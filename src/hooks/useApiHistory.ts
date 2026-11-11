import { useCallback, useEffect, useState } from "react";
import type { ApiHistoryEntry } from "@/types/apiTester";

const STORAGE_KEY = "media-gallery:api-tester-history:v1";
const MAX_HISTORY = 30;

function load(): ApiHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ApiHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Past requests sent from the API Tester module — purely client-side (localStorage),
 * same "activity, not durable content" reasoning as the Editor module's EditorSessions. */
export function useApiHistory() {
  const [history, setHistory] = useState<ApiHistoryEntry[]>(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Storage full/unavailable — history just won't persist across reloads.
    }
  }, [history]);

  const addEntry = useCallback(
    (entry: Omit<ApiHistoryEntry, "id" | "createdAt">) => {
      const full: ApiHistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      setHistory((prev) => [full, ...prev].slice(0, MAX_HISTORY));
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return { history, addEntry, removeEntry, clearHistory };
}
