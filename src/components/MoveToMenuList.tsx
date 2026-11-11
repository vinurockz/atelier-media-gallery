import { useMemo, useState } from "react";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import { FolderInputIcon, SearchIcon } from "@/components/icons";

interface MoveToMenuListProps {
  categories: CategorySummary[];
  currentCategory: string;
  onMoveToCategory: (categoryKey: string) => void;
  onCreateCategoryAndMove: (name: string) => void;

  /** Present only when browsing inside a category — lets an item move between its folders. */
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (folderKey: string | null) => void;
  onCreateFolderAndMove?: (name: string) => void;

  /** Called once a move (or a new-category/folder creation) completes, to close the host popup. */
  onDone: () => void;
}

type PendingCreate = "category" | "folder" | null;

/** The "Move to folder / Move to category" list content, shared by MoveToMenu and ContextMenu. */
export function MoveToMenuList({
  categories,
  currentCategory,
  onMoveToCategory,
  onCreateCategoryAndMove,
  folders,
  currentFolder = null,
  onMoveToFolder,
  onCreateFolderAndMove,
  onDone,
}: MoveToMenuListProps) {
  const [creating, setCreating] = useState<PendingCreate>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  const allCategories = categories.filter((c) => c.key !== currentCategory);
  const allFolders = (folders ?? []).filter((f) => f.key !== currentFolder);
  const showFolders =
    folders !== undefined && onMoveToFolder && onCreateFolderAndMove;

  const normalizedQuery = query.trim().toLowerCase();
  const otherCategories = useMemo(
    () =>
      normalizedQuery
        ? allCategories.filter((c) =>
            c.name.toLowerCase().includes(normalizedQuery),
          )
        : allCategories,
    [allCategories, normalizedQuery],
  );
  const otherFolders = useMemo(
    () =>
      normalizedQuery
        ? allFolders.filter((f) =>
            f.name.toLowerCase().includes(normalizedQuery),
          )
        : allFolders,
    [allFolders, normalizedQuery],
  );

  const submitNew = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (creating === "folder") onCreateFolderAndMove?.(trimmed);
    else if (creating === "category") onCreateCategoryAndMove(trimmed);
    setCreating(null);
    setName("");
    onDone();
  };

  if (creating !== null) {
    return (
      <div className="px-3 py-2">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          New {creating}
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNew();
            if (e.key === "Escape") setCreating(null);
          }}
          placeholder={creating === "folder" ? "Folder name" : "Category name"}
          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-accent"
        />
      </div>
    );
  }

  return (
    <>
      <div className="px-3 pb-1.5 pt-1">
        <div className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1">
          <SearchIcon className="size-3.5 shrink-0 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search categories and folders"
            className="w-full min-w-0 text-sm text-ink outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      {showFolders && (
        <>
          <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Move to folder
          </p>
          {currentFolder !== null && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMoveToFolder?.(null);
                onDone();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-linen-hover"
            >
              <FolderInputIcon className="size-3.5 shrink-0 text-neutral-400" />
              Unsorted
            </button>
          )}
          {normalizedQuery &&
            otherFolders.length === 0 &&
            currentFolder === null && (
              <p className="px-3 py-1.5 text-sm text-neutral-400">
                No matching folders
              </p>
            )}
          {otherFolders.map((f) => (
            <button
              key={f.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onMoveToFolder?.(f.key);
                onDone();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-linen-hover"
            >
              <FolderInputIcon className="size-3.5 shrink-0 text-neutral-400" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreating("folder")}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-accent hover:bg-linen-hover"
          >
            + New folder…
          </button>
          <div className="my-1 border-t border-neutral-100" />
        </>
      )}

      <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
        Move to category
      </p>
      {otherCategories.length === 0 && (
        <p className="px-3 py-1.5 text-sm text-neutral-400">
          {normalizedQuery
            ? "No matching categories"
            : "No other categories yet"}
        </p>
      )}
      {otherCategories.map((c) => (
        <button
          key={c.key}
          type="button"
          role="menuitem"
          onClick={() => {
            onMoveToCategory(c.key);
            onDone();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-linen-hover"
        >
          <FolderInputIcon className="size-3.5 shrink-0 text-neutral-400" />
          <span className="truncate">{c.name}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreating("category")}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-accent hover:bg-linen-hover"
      >
        + New category…
      </button>
    </>
  );
}
