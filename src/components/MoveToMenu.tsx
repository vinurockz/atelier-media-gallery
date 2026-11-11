import { useEffect, useRef, useState } from "react";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import { FolderInputIcon, KebabIcon, TrashIcon } from "@/components/icons";
import { MoveToMenuList } from "@/components/MoveToMenuList";

interface MoveToMenuProps {
  categories: CategorySummary[];
  currentCategory: string;
  onMoveToCategory: (categoryKey: string) => void;
  onCreateCategoryAndMove: (name: string) => void;

  /** Present only when browsing inside a category — lets an item move between its folders. */
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (folderKey: string | null) => void;
  onCreateFolderAndMove?: (name: string) => void;

  /** When provided, adds a "Delete" entry below the move list. */
  onDelete?: () => void;

  /** "icon" (default) is the small per-card kebab; "button" is a labeled trigger for bulk actions. */
  variant?: "icon" | "button";
  disabled?: boolean;
}

/** File-manager-style "Move to…" menu, used on a media card. */
export function MoveToMenu({
  categories,
  currentCategory,
  onMoveToCategory,
  onCreateCategoryAndMove,
  folders,
  currentFolder = null,
  onMoveToFolder,
  onCreateFolderAndMove,
  onDelete,
  variant = "icon",
  disabled = false,
}: MoveToMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {variant === "button" ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-linen-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FolderInputIcon className="size-3.5" />
          Move to…
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Move to category"
          className="flex size-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-linen-hover hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <KebabIcon className="size-4" />
        </button>
      )}

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-20 w-56 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/10"
        >
          <MoveToMenuList
            categories={categories}
            currentCategory={currentCategory}
            onMoveToCategory={onMoveToCategory}
            onCreateCategoryAndMove={onCreateCategoryAndMove}
            folders={folders}
            currentFolder={currentFolder}
            onMoveToFolder={onMoveToFolder}
            onCreateFolderAndMove={onCreateFolderAndMove}
            onDone={() => setOpen(false)}
          />
          {onDelete && (
            <>
              <div className="my-1 border-t border-neutral-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <TrashIcon className="size-3.5 shrink-0" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
