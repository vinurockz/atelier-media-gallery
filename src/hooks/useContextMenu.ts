import { useCallback, useState, type MouseEvent } from "react";

interface ContextMenuState<T> {
  x: number;
  y: number;
  payload: T;
}

/** Right-click popup state: where it opened, and for which item/folder. */
export function useContextMenu<T>() {
  const [state, setState] = useState<ContextMenuState<T> | null>(null);

  const open = useCallback((e: MouseEvent, payload: T) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, payload });
  }, []);

  const close = useCallback(() => setState(null), []);

  return { state, open, close };
}
