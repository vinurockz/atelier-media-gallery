import { useCallback, useRef, useState } from "react";

/**
 * Undo/redo over a single document value — e.g. the image editor's full
 * layers/adjustments/crop state. `set` pushes the previous value onto the
 * undo stack and clears redo (a normal edit); `undo`/`redo` move between
 * snapshots. Callers that need live drag/slider previews should keep that
 * preview in separate local state and only call `set` once the gesture
 * ends, so a single drag doesn't flood the history with every intermediate
 * frame.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const set = useCallback((updater: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: T) => T)(prev)
          : updater;
      undoStack.current = [...undoStack.current, prev];
      redoStack.current = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (undoStack.current.length === 0) return prev;
      const last = undoStack.current[undoStack.current.length - 1];
      undoStack.current = undoStack.current.slice(0, -1);
      redoStack.current = [...redoStack.current, prev];
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (redoStack.current.length === 0) return prev;
      const next = redoStack.current[redoStack.current.length - 1];
      redoStack.current = redoStack.current.slice(0, -1);
      undoStack.current = [...undoStack.current, prev];
      return next;
    });
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
