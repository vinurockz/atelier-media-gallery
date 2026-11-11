import { useCallback, useMemo, useState } from "react";

/** Multi-select state for a gallery view: toggle select mode, pick items, bulk-act. */
export function useSelection() {
  const [active, setActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleMode = useCallback(() => {
    setActive((a) => !a);
    setSelectedIds(new Set());
  }, []);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  return useMemo(
    () => ({ active, selectedIds, toggleMode, toggleItem, clear, isSelected }),
    [active, selectedIds, toggleMode, toggleItem, clear, isSelected],
  );
}

export type SelectionState = ReturnType<typeof useSelection>;
