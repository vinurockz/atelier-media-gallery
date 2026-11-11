import { COLOR_SWATCHES } from "@/lib/color";
import type { ColorName, MediaItem } from "@/types/media";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import { CheckIcon, FilmIcon, PdfIcon, PlayIcon } from "@/components/icons";
import { MoveToMenu } from "@/components/MoveToMenu";

/** The custom drag payload type used to tell "move this card" apart from an OS file drop. */
export const MEDIA_ITEM_DRAG_TYPE = "application/x-media-item-id";

interface MediaCardProps {
  item: MediaItem;
  color: ColorName | null | undefined;
  onSelect: (item: MediaItem) => void;
  /** When provided (with onMoveToCategory), a "Move to…" menu is shown on the card. */
  categories?: CategorySummary[];
  onMoveToCategory?: (itemId: string, categoryKey: string) => void;
  onCreateCategoryAndMove?: (itemId: string, name: string) => void;
  /** Present only inside a category view, to move the item between its folders. */
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (itemId: string, folderKey: string | null) => void;
  onCreateFolderAndMove?: (itemId: string, name: string) => void;
  /** Adds "Delete" to the card's kebab menu. */
  onDelete?: (item: MediaItem) => void;
  /** Multi-select mode: when active, clicking the card toggles selection instead of opening it. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (itemId: string) => void;
  /** Right-click anywhere on the card — the caller owns the popup (one per grid). */
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function MediaCard({
  item,
  color,
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
}: MediaCardProps) {
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
      className={`group flex flex-col overflow-hidden rounded-md border bg-surface shadow-soft transition-shadow hover:shadow-lifted ${
        selected ? "border-accent ring-2 ring-accent/30" : "border-linen"
      }`}
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(MEDIA_ITEM_DRAG_TYPE, item.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={handleActivate}
        className="relative block aspect-square w-full cursor-grab overflow-hidden bg-linen/50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:cursor-grabbing"
      >
        {item.type === "video" ? (
          <>
            <video
              src={item.src}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
            {!selectable && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/5 transition group-hover:bg-ink/15">
                <span className="flex size-7 items-center justify-center rounded-full bg-surface/90 text-ink shadow-soft transition group-hover:scale-110">
                  <PlayIcon className="size-3.5" />
                </span>
              </div>
            )}
          </>
        ) : item.type === "pdf" ? (
          // Defensive — this card is video/image by design (PdfCard is the PDF
          // equivalent); this just avoids a broken <img> if a PDF ever reaches
          // here through a path that forgot to filter it out upstream.
          <div className="flex h-full w-full items-center justify-center bg-red-50 text-red-400">
            <PdfIcon className="size-8" />
          </div>
        ) : (
          <img
            src={item.src}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}

        {selectable ? (
          <span
            className={`absolute left-1.5 top-1.5 flex size-4 items-center justify-center rounded-full ring-2 ring-surface/90 ${
              selected ? "bg-accent" : "bg-ink/40"
            }`}
          >
            {selected && <CheckIcon className="size-2.5 text-surface" />}
          </span>
        ) : (
          item.type === "video" && (
            <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-ink/65 px-1.5 py-0.5 text-[9px] font-medium text-surface backdrop-blur">
              <FilmIcon className="size-2.5" />
            </span>
          )
        )}

        {color && (
          <span
            className="absolute right-1.5 top-1.5 size-2.5 rounded-full ring-2 ring-surface/80 shadow"
            style={{ backgroundColor: COLOR_SWATCHES[color] }}
            title={color}
          />
        )}
      </button>

      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={handleActivate}
          className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink hover:text-accent focus:outline-none focus-visible:underline"
        >
          {item.title}
        </button>
        <div className="flex shrink-0 items-center gap-1">
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
                  onMoveToFolder
                    ? (key) => onMoveToFolder(item.id, key)
                    : undefined
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
      </div>
    </div>
  );
}
