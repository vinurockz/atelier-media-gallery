import { useCallback, useEffect, useState } from "react";
import type { EditorSession } from "@/types/editorSession";

const STORAGE_KEY = "media-gallery:editor-sessions:v1";

function load(): EditorSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EditorSession[]) : [];
  } catch {
    return [];
  }
}

/**
 * Tracks the Editor module's "Images"/"Videos" history (draft + completed sessions),
 * purely client-side in localStorage — this is "what have I been editing" activity
 * referencing MediaItem ids that already live in the file manager, not durable content
 * of its own, so it doesn't go through the server/ backend like Chat/Notes/Bills do.
 */
export function useEditorSessions() {
  const [sessions, setSessions] = useState<EditorSession[]>(load);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Storage full/unavailable — sessions just won't persist across reloads.
    }
  }, [sessions]);

  // Reuses an existing draft for the same source item instead of piling up duplicates
  // every time you reopen the same photo/video without finishing it.
  const startDraft = useCallback(
    (mediaType: "image" | "video", sourceItemId: string) => {
      const existing = sessions.find(
        (s) => s.sourceItemId === sourceItemId && s.status === "draft",
      );
      if (existing) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === existing.id ? { ...s, updatedAt: Date.now() } : s,
          ),
        );
        return existing.id;
      }
      const id = crypto.randomUUID();
      const session: EditorSession = {
        id,
        mediaType,
        sourceItemId,
        status: "draft",
        resultItemId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSessions((prev) => [session, ...prev]);
      return id;
    },
    [sessions],
  );

  const completeSession = useCallback((id: string, resultItemId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: "completed", resultItemId, updatedAt: Date.now() }
          : s,
      ),
    );
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { sessions, startDraft, completeSession, deleteSession };
}
