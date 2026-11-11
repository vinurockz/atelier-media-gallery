import { useState } from "react";
import { EditableLabel } from "@/components/EditableLabel";
import {
  FilmIcon,
  FolderIcon,
  ImageIcon,
  PdfIcon,
  TrashIcon,
} from "@/components/icons";
import { MEDIA_ITEM_DRAG_TYPE } from "@/components/MediaCard";

interface FolderLike {
  name: string;
  count: number;
  videoCount: number;
  imageCount: number;
  pdfCount: number;
}

interface FolderListRowProps {
  folder: FolderLike;
  onOpen: () => void;
  onRename: (next: string) => void;
  onDelete?: () => void;
  onDropItem?: (itemId: string) => void;
  onDropFiles?: (files: File[]) => void;
  deleteConfirmMessage?: (name: string, count: number) => string;
  color?: string | null;
  onContextMenu?: (e: React.MouseEvent) => void;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

const defaultDeleteConfirm = (name: string, count: number) =>
  `Delete "${name}"? Its ${count} ${count === 1 ? "item" : "items"} will move back out, not be deleted.`;

/** List-view row for a folder/category tile — same behavior as FolderTile, Drive's list layout. */
export function FolderListRow({
  folder,
  onOpen,
  onRename,
  onDelete,
  onDropItem,
  onDropFiles,
  deleteConfirmMessage = defaultDeleteConfirm,
  color,
  onContextMenu,
  editing,
  onEditingChange,
}: FolderListRowProps) {
  const { name, count, videoCount, imageCount, pdfCount } = folder;
  const [dragOver, setDragOver] = useState(false);
  const acceptsDrop = Boolean(onDropItem || onDropFiles);

  return (
    <div
      role="button"
      tabIndex={0}
      data-folder-name={name}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onDragOver={(e) => {
        if (!acceptsDrop) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (!acceptsDrop) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const itemId = e.dataTransfer.getData(MEDIA_ITEM_DRAG_TYPE);
        if (itemId && onDropItem) {
          onDropItem(itemId);
          return;
        }
        if (e.dataTransfer.files?.length && onDropFiles) {
          onDropFiles(Array.from(e.dataTransfer.files));
        }
      }}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-md border bg-surface px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        dragOver
          ? "border-accent bg-accent-soft"
          : "border-linen hover:bg-linen-hover"
      }`}
    >
      <FolderIcon
        className="size-5 shrink-0 text-stone/70"
        style={color ? { color } : undefined}
      />
      <div className="min-w-0 flex-1">
        <EditableLabel
          value={name}
          onCommit={onRename}
          revealOnHover
          className="text-sm font-medium text-ink"
          editing={editing}
          onEditingChange={onEditingChange}
        />
      </div>
      <div className="hidden shrink-0 items-center gap-3 text-xs text-stone sm:flex">
        {videoCount > 0 && (
          <span className="flex items-center gap-1">
            <FilmIcon className="size-3.5" />
            {videoCount}
          </span>
        )}
        {imageCount > 0 && (
          <span className="flex items-center gap-1">
            <ImageIcon className="size-3.5" />
            {imageCount}
          </span>
        )}
        {pdfCount > 0 && (
          <span className="flex items-center gap-1">
            <PdfIcon className="size-3.5" />
            {pdfCount}
          </span>
        )}
        {count === 0 && <span>Empty</span>}
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(deleteConfirmMessage(name, count))) {
              onDelete();
            }
          }}
          title="Delete"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone/50 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
        >
          <TrashIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
