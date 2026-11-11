import type { ColorName, MediaItem } from "@/types/media";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import type { SelectionState } from "@/hooks/useSelection";
import type { ViewMode } from "@/hooks/useViewMode";
import { useContextMenu } from "@/hooks/useContextMenu";
import { downloadMediaItem } from "@/lib/download";
import { MediaCard } from "@/components/MediaCard";
import { MediaListRow } from "@/components/MediaListRow";
import { MoveToMenuList } from "@/components/MoveToMenuList";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "@/components/ContextMenu";
import { DownloadIcon, PlayIcon, TrashIcon } from "@/components/icons";

interface GalleryGridProps {
  items: MediaItem[];
  colors: Record<string, ColorName | null | undefined>;
  /** List view only — bytes, when known. See useMediaSizes. */
  sizes?: Record<string, number | null | undefined>;
  onSelect: (item: MediaItem) => void;
  categories?: CategorySummary[];
  onMoveToCategory?: (itemId: string, categoryKey: string) => void;
  onCreateCategoryAndMove?: (itemId: string, name: string) => void;
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (itemId: string, folderKey: string | null) => void;
  onCreateFolderAndMove?: (itemId: string, name: string) => void;
  /** Deletes an item outright (after confirming) — never passed a "move" fallback, just removal. */
  onDelete?: (item: MediaItem) => void;
  selection?: SelectionState;
  emptyLabel?: string;
  viewMode?: ViewMode;
}

export function GalleryGrid({
  items,
  colors,
  sizes,
  onSelect,
  categories,
  onMoveToCategory,
  onCreateCategoryAndMove,
  folders,
  currentFolder,
  onMoveToFolder,
  onCreateFolderAndMove,
  onDelete,
  selection,
  emptyLabel = "No media matches these filters.",
  viewMode = "grid",
}: GalleryGridProps) {
  const menu = useContextMenu<MediaItem>();
  const canMove = Boolean(
    categories && onMoveToCategory && onCreateCategoryAndMove,
  );

  const handleDelete = onDelete
    ? (item: MediaItem) => {
        const isImported = item.id.startsWith("imported:");
        const message = isImported
          ? `Delete "${item.title}"? This permanently removes the imported file — it can't be undone.`
          : `Delete "${item.title}"? It'll be hidden from the gallery — the file stays on your computer in src/assets.`;
        if (window.confirm(message)) onDelete(item);
      }
    : undefined;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-14 text-center">
        <p className="text-sm font-medium text-neutral-600">{emptyLabel}</p>
      </div>
    );
  }

  const contextMenu = menu.state && (
    <ContextMenu x={menu.state.x} y={menu.state.y} onClose={menu.close}>
      <ContextMenuButton
        icon={PlayIcon}
        label="Open"
        onClick={() => {
          onSelect(menu.state!.payload);
          menu.close();
        }}
      />
      <ContextMenuButton
        icon={DownloadIcon}
        label="Download"
        onClick={() => {
          downloadMediaItem(menu.state!.payload);
          menu.close();
        }}
      />
      {canMove && categories && onMoveToCategory && onCreateCategoryAndMove && (
        <>
          <ContextMenuDivider />
          <MoveToMenuList
            categories={categories}
            currentCategory={menu.state.payload.category}
            onMoveToCategory={(key) => {
              onMoveToCategory(menu.state!.payload.id, key);
              menu.close();
            }}
            onCreateCategoryAndMove={(name) => {
              onCreateCategoryAndMove(menu.state!.payload.id, name);
              menu.close();
            }}
            folders={folders}
            currentFolder={currentFolder}
            onMoveToFolder={
              onMoveToFolder
                ? (key) => {
                    onMoveToFolder(menu.state!.payload.id, key);
                    menu.close();
                  }
                : undefined
            }
            onCreateFolderAndMove={
              onCreateFolderAndMove
                ? (name) => {
                    onCreateFolderAndMove(menu.state!.payload.id, name);
                    menu.close();
                  }
                : undefined
            }
            onDone={menu.close}
          />
        </>
      )}
      {handleDelete && (
        <>
          <ContextMenuDivider />
          <ContextMenuButton
            icon={TrashIcon}
            label="Delete"
            danger
            onClick={() => {
              handleDelete(menu.state!.payload);
              menu.close();
            }}
          />
        </>
      )}
    </ContextMenu>
  );

  if (viewMode === "list") {
    return (
      <>
        <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 rounded-lg ring-1 ring-black/5 lg:grid-cols-2">
          {items.map((item) => (
            <MediaListRow
              key={item.id}
              item={item}
              color={colors[item.id]}
              size={sizes?.[item.id]}
              onSelect={onSelect}
              categories={categories}
              onMoveToCategory={onMoveToCategory}
              onCreateCategoryAndMove={onCreateCategoryAndMove}
              folders={folders}
              currentFolder={currentFolder}
              onMoveToFolder={onMoveToFolder}
              onCreateFolderAndMove={onCreateFolderAndMove}
              onDelete={handleDelete}
              selectable={selection?.active}
              selected={selection?.isSelected(item.id)}
              onToggleSelect={selection?.toggleItem}
              onContextMenu={(e) => menu.open(e, item)}
            />
          ))}
        </div>
        {contextMenu}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            color={colors[item.id]}
            onSelect={onSelect}
            categories={categories}
            onMoveToCategory={onMoveToCategory}
            onCreateCategoryAndMove={onCreateCategoryAndMove}
            folders={folders}
            currentFolder={currentFolder}
            onMoveToFolder={onMoveToFolder}
            onCreateFolderAndMove={onCreateFolderAndMove}
            onDelete={handleDelete}
            selectable={selection?.active}
            selected={selection?.isSelected(item.id)}
            onToggleSelect={selection?.toggleItem}
            onContextMenu={(e) => menu.open(e, item)}
          />
        ))}
      </div>
      {contextMenu}
    </>
  );
}
