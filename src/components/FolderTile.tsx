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
import type { MediaItem } from "@/types/media";

interface FolderLike {
  name: string;
  count: number;
  videoCount: number;
  imageCount: number;
  pdfCount: number;
  cover: MediaItem | null;
}

interface FolderTileProps {
  folder: FolderLike;
  onOpen: () => void;
  onRename: (next: string) => void;
  onDelete?: () => void;
  /** Dropping a card from elsewhere in the gallery moves it here. */
  onDropItem?: (itemId: string) => void;
  /** Dropping files from outside the browser (e.g. the desktop) imports them here. */
  onDropFiles?: (files: File[]) => void;
  /** Confirm-dialog text; defaults to folder wording. Pass this for category tiles. */
  deleteConfirmMessage?: (name: string, count: number) => string;
  /** The folder's assigned color (hex), if any — shown as a small tab on the tile. */
  color?: string | null;
  /** Right-click anywhere on the tile — the caller owns the popup (one per grid). */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Lets a "Rename" context-menu action open the name editor from outside. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

const defaultDeleteConfirm = (name: string, count: number) =>
  `Delete "${name}"? Its ${count} ${count === 1 ? "item" : "items"} will move back out, not be deleted.`;

/** A folder-style tile: used for both top-level categories and folders inside one. */
export function FolderTile({
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
}: FolderTileProps) {
  const { cover, name, count, videoCount, imageCount, pdfCount } = folder;
  const [dragOver, setDragOver] = useState(false);
  const acceptsDrop = Boolean(onDropItem || onDropFiles);

  return (
    <div className="group relative">
      {/* Stacked sheets behind the tile give it a "folder of files" feel. */}
      <div
        className="absolute inset-x-2 -top-1 h-full rounded-md bg-linen/60"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-1 -top-0.5 h-full rounded-md bg-surface ring-1 ring-linen"
        aria-hidden="true"
      />

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
          // Stop this folder's own drop zone from also triggering the
          // category/folder view's "drop files anywhere" zone behind it.
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
        className={`relative flex w-full cursor-pointer flex-col overflow-hidden rounded-md border bg-surface text-left shadow-soft transition-shadow hover:shadow-lifted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          dragOver ? "border-accent ring-2 ring-accent/30" : "border-linen"
        }`}
      >
        {color && (
          <span
            className="absolute inset-x-0 top-0 z-10 h-[3px]"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        )}
        <div className="relative aspect-square w-full overflow-hidden bg-linen/50">
          {cover ? (
            cover.type === "video" ? (
              <video
                src={cover.src}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={cover.src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-stone/40"
              style={color ? { color } : undefined}
            >
              <FolderIcon className="size-7" />
            </div>
          )}
          <span className="absolute left-1.5 top-2 flex items-center gap-0.5 rounded-full bg-ink/65 px-1.5 py-0.5 text-[9px] font-medium text-surface backdrop-blur">
            <FolderIcon className="size-2.5" />
            {count}
          </span>
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
              className="absolute right-1.5 top-2 flex size-5 items-center justify-center rounded-full bg-ink/65 text-surface opacity-0 backdrop-blur transition hover:bg-red-700 group-hover:opacity-100"
            >
              <TrashIcon className="size-3" />
            </button>
          )}
          {dragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-accent/25 text-xs font-medium text-surface">
              Drop here
            </div>
          )}
        </div>

        <div className="px-2.5 py-2">
          <EditableLabel
            value={name}
            onCommit={onRename}
            revealOnHover
            className="text-[13px] font-semibold text-ink"
            editing={editing}
            onEditingChange={onEditingChange}
          />
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-stone">
            {videoCount > 0 && (
              <span className="flex items-center gap-0.5">
                <FilmIcon className="size-3" />
                {videoCount}
              </span>
            )}
            {imageCount > 0 && (
              <span className="flex items-center gap-0.5">
                <ImageIcon className="size-3" />
                {imageCount}
              </span>
            )}
            {pdfCount > 0 && (
              <span className="flex items-center gap-0.5">
                <PdfIcon className="size-3" />
                {pdfCount}
              </span>
            )}
            {count === 0 && <span>Empty</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
