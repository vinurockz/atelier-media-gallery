import type { MediaItem } from "@/types/media";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import { PdfIcon, TrashIcon } from "@/components/icons";
import { MoveToMenu } from "@/components/MoveToMenu";
import { MEDIA_ITEM_DRAG_TYPE } from "@/components/MediaCard";

interface PdfCardProps {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
  categories: CategorySummary[];
  onMoveToCategory: (itemId: string, categoryKey: string) => void;
  onCreateCategoryAndMove: (itemId: string, name: string) => void;
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (itemId: string, folderKey: string | null) => void;
  onCreateFolderAndMove?: (itemId: string, name: string) => void;
  onDelete: (item: MediaItem) => void;
}

/** A PDF's grid tile — same drag-to-folder and "Move to…" behavior as MediaCard,
 * but with its own fixed document-icon face instead of a video/image thumbnail. */
export function PdfCard({
  item,
  onOpen,
  categories,
  onMoveToCategory,
  onCreateCategoryAndMove,
  folders,
  currentFolder,
  onMoveToFolder,
  onCreateFolderAndMove,
  onDelete,
}: PdfCardProps) {
  return (
    <div
      data-media-id={item.id}
      className="group flex flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(MEDIA_ITEM_DRAG_TYPE, item.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onOpen(item)}
        className="flex aspect-square w-full cursor-grab flex-col items-center justify-center gap-1.5 bg-red-50 text-red-500 transition group-hover:bg-red-100 active:cursor-grabbing"
      >
        <PdfIcon className="size-9" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          PDF
        </span>
      </button>

      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="min-w-0 flex-1 truncate text-left text-xs font-medium text-neutral-800 hover:text-neutral-950 focus:outline-none focus-visible:underline"
        >
          {item.title}
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
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
          />
          <button
            type="button"
            onClick={() => onDelete(item)}
            title="Delete"
            aria-label={`Delete ${item.title}`}
            className="flex size-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
