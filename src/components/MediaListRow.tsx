import { COLOR_SWATCHES } from "@/lib/color";
import { formatBytes } from "@/lib/formatBytes";
import { formatDateTime } from "@/lib/formatDate";
import type { ColorName, MediaItem } from "@/types/media";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import { CheckIcon, FilmIcon, ImageIcon } from "@/components/icons";
import { MoveToMenu } from "@/components/MoveToMenu";
import { MEDIA_ITEM_DRAG_TYPE } from "@/components/MediaCard";

interface MediaListRowProps {
  item: MediaItem;
  color: ColorName | null | undefined;
  /** Bytes, when known — see useMediaSizes. */
  size?: number | null;
  onSelect: (item: MediaItem) => void;
  categories?: CategorySummary[];
  onMoveToCategory?: (itemId: string, categoryKey: string) => void;
  onCreateCategoryAndMove?: (itemId: string, name: string) => void;
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (itemId: string, folderKey: string | null) => void;
  onCreateFolderAndMove?: (itemId: string, name: string) => void;
  onDelete?: (item: MediaItem) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (itemId: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** Drive-style list row for a media item — same capabilities as MediaCard, one line per item. */
export function MediaListRow({
  item,
  color,
  size,
  onSelect,
  categories,
  onMoveToCategory,
  onCreateCategoryAndMove,
  folders,
  currentFolder,
  onMoveToFolder,
  onCreateFolderAndMove,
  onDelete,
  selectable = false,
  selected = false,
  onToggleSelect,
  onContextMenu,
}: MediaListRowProps) {
  const canMove = Boolean(
    categories && onMoveToCategory && onCreateCategoryAndMove,
  );

  const handleActivate = () => {
    if (selectable && onToggleSelect) onToggleSelect(item.id);
    else onSelect(item);
  };

  return (
    <div
      data-media-id={item.id}
      onContextMenu={onContextMenu}
      className={`group flex items-center gap-3 rounded-lg bg-white px-2 py-1.5 ring-1 ring-black/5 transition hover:bg-linen-hover ${
        selected ? "bg-accent/10" : ""
      }`}
    >
      {selectable && (
        <button
          type="button"
          onClick={handleActivate}
          className={`flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ring-neutral-300 ${
            selected ? "bg-accent ring-accent" : "bg-white"
          }`}
        >
          {selected && <CheckIcon className="size-3.5 text-white" />}
        </button>
      )}

      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(MEDIA_ITEM_DRAG_TYPE, item.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={handleActivate}
        className="relative size-10 shrink-0 cursor-grab overflow-hidden rounded-md bg-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
      >
        {item.type === "video" ? (
          <video
            src={item.src}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={item.src}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </button>

      <button
        type="button"
        onClick={handleActivate}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-neutral-800 hover:text-neutral-950 focus:outline-none focus-visible:underline"
      >
        {item.title}
      </button>

      <span className="hidden shrink-0 items-center gap-1 text-xs text-neutral-400 sm:flex">
        {item.type === "video" ? (
          <FilmIcon className="size-3.5" />
        ) : (
          <ImageIcon className="size-3.5" />
        )}
        {item.type === "video" ? "Video" : "Picture"}
      </span>

      <span className="hidden shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 sm:inline">
        {item.category}
      </span>

      <span
        className="hidden w-16 shrink-0 text-right text-xs text-neutral-400 xl:inline"
        title="File size"
      >
        {formatBytes(size)}
      </span>

      <span
        className="hidden w-32 shrink-0 text-right text-xs text-neutral-400 2xl:inline"
        title="Uploaded"
      >
        {item.addedAt ? formatDateTime(item.addedAt) : "Bundled asset"}
      </span>

      {color && (
        <span
          className="size-3 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: COLOR_SWATCHES[color] }}
          title={color}
        />
      )}

      {!selectable &&
        canMove &&
        categories &&
        onMoveToCategory &&
        onCreateCategoryAndMove && (
          <MoveToMenu
            categories={categories}
            currentCategory={item.category}
            onMoveToCategory={(key) => onMoveToCategory(item.id, key)}
            onCreateCategoryAndMove={(name) =>
              onCreateCategoryAndMove(item.id, name)
            }
            folders={folders}
            currentFolder={currentFolder}
            onMoveToFolder={
              onMoveToFolder ? (key) => onMoveToFolder(item.id, key) : undefined
            }
            onCreateFolderAndMove={
              onCreateFolderAndMove
                ? (name) => onCreateFolderAndMove(item.id, name)
                : undefined
            }
            onDelete={onDelete ? () => onDelete(item) : undefined}
          />
        )}
    </div>
  );
}
