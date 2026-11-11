import { useMemo, useState } from "react";
import type { MediaItem } from "@/types/media";
import {
  CheckIcon,
  ChevronLeftIcon,
  CloseIcon,
  FilmIcon,
  FolderIcon,
  SearchIcon,
} from "@/components/icons";

interface AttachMediaModalProps {
  items: MediaItem[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
  /** Default true (multi-select, "Attach N"). false picks a single item immediately on click. */
  multiple?: boolean;
  /** Restricts the grid to one media type — e.g. the image editor only wants pictures. */
  typeFilter?: "image" | "video";
  title?: string;
}

interface CategoryGroup {
  key: string;
  items: MediaItem[];
}

/** Picker for choosing existing file-manager media — reused across chat attachments, the
 * editor, and the website builder's block fields. Opens to your categories first (same
 * browsing model as the Files module) and drills into one to actually pick an item —
 * skips straight to the grid when there's only one category to show. */
export function AttachMediaModal({
  items,
  onClose,
  onConfirm,
  multiple = true,
  typeFilter,
  title = "Attach from your library",
}: AttachMediaModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  const visibleItems = typeFilter
    ? items.filter((item) => item.type === typeFilter)
    : items;

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, MediaItem[]>();
    for (const item of visibleItems) {
      const group = map.get(item.category);
      if (group) group.push(item);
      else map.set(item.category, [item]);
    }
    return Array.from(map, ([key, groupItems]) => ({
      key,
      items: groupItems,
    })).sort((a, b) => a.key.localeCompare(b.key));
  }, [visibleItems]);

  const normalizedCategoryQuery = categoryQuery.trim().toLowerCase();
  const visibleCategoryGroups = normalizedCategoryQuery
    ? categoryGroups.filter((g) =>
        g.key.toLowerCase().includes(normalizedCategoryQuery),
      )
    : categoryGroups;

  const showCategoryList = categoryGroups.length > 1 && openCategory === null;
  const activeCategory = showCategoryList
    ? null
    : (openCategory ?? categoryGroups[0]?.key ?? null);
  const activeItems =
    categoryGroups.find((group) => group.key === activeCategory)?.items ?? [];

  const toggle = (id: string) => {
    if (!multiple) {
      onConfirm([id]);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-linen bg-surface shadow-lifted">
        <div className="flex items-center justify-between border-b border-linen px-4 py-3">
          <div className="flex min-w-0 items-center gap-1">
            {!showCategoryList && categoryGroups.length > 1 && (
              <button
                type="button"
                onClick={() => setOpenCategory(null)}
                aria-label="Back to categories"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-linen-hover hover:text-ink"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
            )}
            <h2 className="truncate text-sm font-semibold text-ink">
              {showCategoryList ? title : activeCategory}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        {showCategoryList && categoryGroups.length > 6 && (
          <div className="border-b border-linen px-4 py-2.5">
            <div className="flex items-center gap-1.5 rounded-md border border-linen px-2.5 py-1.5">
              <SearchIcon className="size-3.5 shrink-0 text-stone" />
              <input
                autoFocus
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="Search categories…"
                aria-label="Search categories"
                className="w-full min-w-0 text-sm text-ink outline-none placeholder:text-stone/60"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {visibleItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone">
              Nothing in your library yet.
            </p>
          ) : showCategoryList ? (
            visibleCategoryGroups.length === 0 ? (
              <p className="py-10 text-center text-sm text-stone">
                No matching categories.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {visibleCategoryGroups.map((group) => {
                  const cover = group.items[0];
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setOpenCategory(group.key)}
                      className="group flex flex-col overflow-hidden rounded-md border border-linen bg-surface text-left shadow-soft transition-shadow hover:shadow-lifted"
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-linen/50">
                        {cover.type === "video" ? (
                          <video
                            src={cover.src}
                            muted
                            playsInline
                            preload="metadata"
                            draggable={false}
                            className="pointer-events-none h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={cover.src}
                            alt=""
                            loading="lazy"
                            draggable={false}
                            className="pointer-events-none h-full w-full object-cover"
                          />
                        )}
                        <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-ink/65 px-1.5 py-0.5 text-[9px] font-medium text-surface backdrop-blur">
                          <FolderIcon className="size-2.5" />
                          {group.items.length}
                        </span>
                      </div>
                      <span className="truncate px-2 py-1.5 text-[13px] font-medium text-ink">
                        {group.key}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {activeItems.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`relative aspect-square overflow-hidden rounded-lg ring-2 transition ${
                      isSelected
                        ? "ring-accent"
                        : "ring-transparent hover:ring-linen"
                    }`}
                  >
                    {item.type === "video" ? (
                      <video
                        src={item.src}
                        muted
                        playsInline
                        preload="metadata"
                        draggable={false}
                        className="pointer-events-none h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.src}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="pointer-events-none h-full w-full object-cover"
                      />
                    )}
                    {item.type === "video" && (
                      <span className="absolute left-1.5 top-1.5 flex items-center justify-center rounded-full bg-ink/65 p-1 text-surface">
                        <FilmIcon className="size-3" />
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-accent/30">
                        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-surface">
                          <CheckIcon className="size-3.5" />
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-linen px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-stone transition-colors hover:bg-linen-hover"
          >
            Cancel
          </button>
          {multiple && (
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onConfirm(Array.from(selected))}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Attach{selected.size > 0 ? ` ${selected.size}` : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
