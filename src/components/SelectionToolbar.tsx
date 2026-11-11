import { useState } from "react";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import type { SelectionState } from "@/hooks/useSelection";
import type { MediaItem } from "@/types/media";
import { downloadItemsAsZip } from "@/lib/zip";
import { MoveToMenu } from "@/components/MoveToMenu";
import { DownloadIcon, SpinnerIcon, TrashIcon } from "@/components/icons";

interface SelectionToolbarProps {
  selection: SelectionState;
  allItems: MediaItem[];
  zipBaseName: string;
  categories: CategorySummary[];
  currentCategory: string;
  onMoveToCategory: (ids: string[], categoryKey: string) => void;
  onCreateCategoryAndMove: (ids: string[], name: string) => void;
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (ids: string[], folderKey: string | null) => void;
  onCreateFolderAndMove?: (ids: string[], name: string) => void;
  /** Deletes every selected item (after confirming). */
  onDelete?: (ids: string[]) => Promise<void> | void;
}

/** Appears once "Select" mode is active: count + bulk move/download actions. */
export function SelectionToolbar({
  selection,
  allItems,
  zipBaseName,
  categories,
  currentCategory,
  onMoveToCategory,
  onCreateCategoryAndMove,
  folders,
  currentFolder,
  onMoveToFolder,
  onCreateFolderAndMove,
  onDelete,
}: SelectionToolbarProps) {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!selection.active) return null;

  const ids = Array.from(selection.selectedIds);
  const selectedItems = allItems.filter((item) =>
    selection.isSelected(item.id),
  );
  const hasSelection = ids.length > 0;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadItemsAsZip(selectedItems, `${zipBaseName}-selection`);
    } catch (err) {
      console.error("Zip download failed", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const importedCount = selectedItems.filter((item) =>
      item.id.startsWith("imported:"),
    ).length;
    const hiddenCount = ids.length - importedCount;
    const parts: string[] = [];
    if (importedCount > 0) {
      parts.push(
        `${importedCount} imported ${importedCount === 1 ? "file" : "files"} removed for good`,
      );
    }
    if (hiddenCount > 0) {
      parts.push(
        `${hiddenCount} ${hiddenCount === 1 ? "item" : "items"} hidden from the gallery (kept on disk)`,
      );
    }
    const message = `Delete ${ids.length} ${ids.length === 1 ? "item" : "items"}? ${parts.join("; ")}.`;
    if (!window.confirm(message)) return;

    setDeleting(true);
    try {
      await onDelete(ids);
      selection.clear();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-neutral-900 px-4 py-2.5 text-white">
      <span className="text-sm font-medium">
        {ids.length} {ids.length === 1 ? "item" : "items"} selected
      </span>

      <div className="flex items-center gap-2">
        <MoveToMenu
          variant="button"
          disabled={!hasSelection}
          categories={categories}
          currentCategory={currentCategory}
          onMoveToCategory={(key) => {
            onMoveToCategory(ids, key);
            selection.clear();
          }}
          onCreateCategoryAndMove={(name) => {
            onCreateCategoryAndMove(ids, name);
            selection.clear();
          }}
          folders={folders}
          currentFolder={currentFolder}
          onMoveToFolder={
            onMoveToFolder
              ? (key) => {
                  onMoveToFolder(ids, key);
                  selection.clear();
                }
              : undefined
          }
          onCreateFolderAndMove={
            onCreateFolderAndMove
              ? (name) => {
                  onCreateFolderAndMove(ids, name);
                  selection.clear();
                }
              : undefined
          }
        />

        <button
          type="button"
          onClick={handleDownload}
          disabled={!hasSelection || downloading}
          className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? (
            <SpinnerIcon className="size-3.5 animate-spin" />
          ) : (
            <DownloadIcon className="size-3.5" />
          )}
          Download ZIP
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={!hasSelection || deleting}
            className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? (
              <SpinnerIcon className="size-3.5 animate-spin" />
            ) : (
              <TrashIcon className="size-3.5" />
            )}
            Delete
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {hasSelection && (
          <button
            type="button"
            onClick={selection.clear}
            className="text-xs font-medium text-white/70 hover:text-white"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={selection.toggleMode}
          className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
        >
          Done
        </button>
      </div>
    </div>
  );
}
