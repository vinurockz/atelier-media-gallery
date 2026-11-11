import { useMemo, useState } from "react";
import type { ColorName, MediaItem, MediaType } from "@/types/media";
import type { CategorySummary, FolderSummary } from "@/hooks/useOrganization";
import type { SelectionState } from "@/hooks/useSelection";
import type { ViewMode } from "@/hooks/useViewMode";
import { ColorFilter } from "@/components/ColorFilter";
import { GalleryGrid } from "@/components/GalleryGrid";
import { FilmIcon, ImageIcon } from "@/components/icons";

interface MediaTypeSectionProps {
  type: MediaType;
  items: MediaItem[];
  colors: Record<string, ColorName | null | undefined>;
  sizes?: Record<string, number | null | undefined>;
  onSelect: (items: MediaItem[], index: number) => void;
  categories: CategorySummary[];
  onMoveToCategory: (itemId: string, categoryKey: string) => void;
  onCreateCategoryAndMove: (itemId: string, name: string) => void;
  folders?: FolderSummary[];
  currentFolder?: string | null;
  onMoveToFolder?: (itemId: string, folderKey: string | null) => void;
  onCreateFolderAndMove?: (itemId: string, name: string) => void;
  onDelete?: (item: MediaItem) => void;
  selection?: SelectionState;
  viewMode?: ViewMode;
}

/**
 * One "Videos" or "Pictures" section inside a category (or folder): its own
 * heading, its own color filter scoped to just this type, and its own grid.
 */
export function MediaTypeSection({
  type,
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
  viewMode,
}: MediaTypeSectionProps) {
  const [color, setColor] = useState<ColorName | "all">("all");

  const colorCounts = useMemo(() => {
    const counts: Partial<Record<ColorName, number>> = {};
    for (const item of items) {
      const c = colors[item.id];
      if (c) counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [items, colors]);

  const filtered = useMemo(
    () => items.filter((item) => color === "all" || colors[item.id] === color),
    [items, color, colors],
  );

  if (items.length === 0) return null;

  const Icon = type === "video" ? FilmIcon : ImageIcon;
  const label = type === "video" ? "Videos" : "Pictures";

  return (
    <section className="mt-8 first:mt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-800">
          <Icon className="size-4 text-neutral-400" />
          {label}
          <span className="text-sm font-normal text-neutral-400">
            {items.length}
          </span>
        </h2>
        <ColorFilter active={color} onChange={setColor} counts={colorCounts} />
      </div>

      <div className="mt-4">
        <GalleryGrid
          items={filtered}
          colors={colors}
          sizes={sizes}
          onSelect={(item) => onSelect(filtered, filtered.indexOf(item))}
          categories={categories}
          onMoveToCategory={onMoveToCategory}
          onCreateCategoryAndMove={onCreateCategoryAndMove}
          folders={folders}
          currentFolder={currentFolder}
          onMoveToFolder={onMoveToFolder}
          onCreateFolderAndMove={onCreateFolderAndMove}
          onDelete={onDelete}
          selection={selection}
          emptyLabel={`No ${label.toLowerCase()} match this color.`}
          viewMode={viewMode}
        />
      </div>
    </section>
  );
}
