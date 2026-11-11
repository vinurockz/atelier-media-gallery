import { useCallback, useState, type DragEvent } from "react";

/**
 * Turns an element into a drop target for files dragged in from outside the
 * browser (the OS file manager). Ignores in-app card drags (those carry a
 * custom MIME type, not "Files") so dropping a card on empty space here is
 * a no-op rather than misfiring an import.
 */
export function useFileDropZone(onFiles: (files: File[]) => void) {
  const [active, setActive] = useState(false);

  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setActive(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setActive(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return { active, handlers: { onDragOver, onDragLeave, onDrop } };
}
