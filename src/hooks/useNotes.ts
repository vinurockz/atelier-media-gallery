import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/types/notes";
import {
  createNote as createNoteRemote,
  deleteNote as deleteNoteRemote,
  fetchNotes,
  updateNote,
  type NotePatch,
} from "@/lib/api/notes";

const POLL_INTERVAL_MS = 5000;
const SAVE_DEBOUNCE_MS = 600;

/**
 * Sticky notes, backed by the Node API in `server/` (see src/lib/api/notes.ts) — same
 * durable-JSON-file model as contents/categories. Edits (title, color, pinned, blocks)
 * update local state immediately and save remotely on a short debounce per note, so
 * typing in the note editor doesn't fire a request per keystroke.
 */
export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const saveTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, NotePatch>>(new Map());

  useEffect(() => {
    fetchNotes()
      .then(setNotes)
      .catch(() => {
        // No backend reachable yet — notes just stays empty until it is.
      });
  }, []);

  // Light polling so a second tab picks up changes — notes change far less often than
  // chat messages, so a longer interval than useChat's is enough.
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchNotes()
        .then(setNotes)
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const flushNote = useCallback((id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    pendingPatches.current.delete(id);
    void updateNote(id, patch).catch(() => {});
  }, []);

  const patchNote = useCallback(
    (id: string, patch: NotePatch) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
        ),
      );
      const existing = pendingPatches.current.get(id) ?? {};
      pendingPatches.current.set(id, { ...existing, ...patch });

      const timer = saveTimers.current.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      saveTimers.current.set(
        id,
        window.setTimeout(() => flushNote(id), SAVE_DEBOUNCE_MS),
      );
    },
    [flushNote],
  );

  const addNote = useCallback(async (title = "") => {
    const note = await createNoteRemote(title);
    setNotes((prev) => [note, ...prev]);
    return note.id;
  }, []);

  const removeNote = useCallback(async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimers.current.delete(id);
    pendingPatches.current.delete(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await deleteNoteRemote(id).catch(() => {});
  }, []);

  return { notes, addNote, patchNote, flushNote, removeNote };
}
