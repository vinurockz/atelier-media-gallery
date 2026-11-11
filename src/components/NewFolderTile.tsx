import { useEffect, useRef, useState } from "react";
import { FolderPlusIcon } from "@/components/icons";

interface NewFolderTileProps {
  label: string;
  onCreate: (name: string) => void;
  /** "tile" (default) is the square grid tile; "row" is a compact list-view row. */
  variant?: "tile" | "row";
}

export function NewFolderTile({
  label,
  onCreate,
  variant = "tile",
}: NewFolderTileProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed);
    setName("");
    setOpen(false);
  };

  if (open) {
    const containerClass =
      variant === "row"
        ? "flex items-center gap-2 rounded-md border-2 border-dashed border-accent/35 bg-accent-soft/60 p-2"
        : "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-accent/35 bg-accent-soft/60 p-2.5";
    return (
      <div className={containerClass}>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setName("");
              setOpen(false);
            }
          }}
          placeholder="Name"
          className="w-full rounded-md border border-linen bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        <div
          className="flex w-full shrink-0 gap-2"
          style={variant === "row" ? { width: "auto" } : undefined}
        >
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-surface hover:bg-accent-hover"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setName("");
              setOpen(false);
            }}
            className="flex-1 rounded-md border border-linen bg-surface px-2.5 py-1.5 text-xs font-medium text-stone hover:bg-linen-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border-2 border-dashed border-linen px-3 py-2 text-stone transition-colors hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FolderPlusIcon className="size-4" />
        <span className="text-sm font-medium">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-linen text-stone transition-colors hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <FolderPlusIcon className="size-5" />
      <span className="text-center text-xs font-medium">{label}</span>
    </button>
  );
}
