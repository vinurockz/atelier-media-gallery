import { useEffect, useRef, useState } from "react";
import { PencilIcon } from "@/components/icons";

interface EditableLabelProps {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  inputClassName?: string;
  /** Hide the pencil affordance until the wrapper is hovered/focused. */
  revealOnHover?: boolean;
  /** Controlled edit state, so a "Rename" action elsewhere (e.g. a context menu) can open it. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

/** Click-to-rename text: a label with a pencil icon that swaps to an input. */
export function EditableLabel({
  value,
  onCommit,
  className = "",
  inputClassName = "",
  revealOnHover = false,
  editing: controlledEditing,
  onEditingChange,
}: EditableLabelProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = controlledEditing ?? internalEditing;
  const setEditing = onEditingChange ?? setInternalEditing;
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Stop Enter/Escape from bubbling to an ancestor's own key handler
          // (e.g. a folder tile's "Enter/Space to open" listener).
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded border border-accent bg-white px-1.5 py-0.5 text-sm font-medium text-neutral-900 outline-none ${inputClassName}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className={`flex items-center gap-1.5 text-left ${className}`}
      title="Rename"
    >
      <span className="truncate">{value}</span>
      <PencilIcon
        className={`size-3.5 shrink-0 text-neutral-400 transition hover:text-neutral-600 ${
          revealOnHover
            ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            : ""
        }`}
      />
    </button>
  );
}
