import { useCallback, useEffect, useMemo, useState } from "react";
import type { MediaItem } from "@/types/media";
import {
  createCategoryRemote,
  createFolderRemote,
  fetchCategories,
} from "@/lib/api/categories";

export interface CategorySummary {
  key: string;
  name: string;
  count: number;
  videoCount: number;
  imageCount: number;
  pdfCount: number;
  cover: MediaItem | null;
}

export interface FolderSummary {
  key: string;
  name: string;
  count: number;
  videoCount: number;
  imageCount: number;
  pdfCount: number;
  cover: MediaItem | null;
}

interface OrgState {
  /** category key -> display name, for renamed categories. */
  categoryNames: Record<string, string>;
  /** media item id -> category key it was moved to. */
  itemMoves: Record<string, string>;
  /** categories created from the UI that may still be empty. */
  customCategories: string[];
  /** category key -> folder names that exist in it (including empty ones). */
  categoryFolders: Record<string, string[]>;
  /** media item id -> folder name within its current category ("unsorted" if absent). */
  itemFolders: Record<string, string>;
  /** "categoryKey" or "categoryKey::folderName" -> assigned folder color (hex). */
  folderColors: Record<string, string>;
  /** Media item ids deleted from the gallery (hidden, not removed from disk). */
  hiddenItemIds: string[];
}

const STORAGE_KEY = "media-gallery:organization:v2";
const EMPTY_STATE: OrgState = {
  categoryNames: {},
  itemMoves: {},
  customCategories: [],
  categoryFolders: {},
  itemFolders: {},
  folderColors: {},
  hiddenItemIds: [],
};

/** Storage key for a category's own color, or a folder's color within it. */
function colorKey(categoryKey: string, folderName?: string | null): string {
  return folderName ? `${categoryKey}::${folderName}` : categoryKey;
}

function loadState(): OrgState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<OrgState>;
    return {
      categoryNames: parsed.categoryNames ?? {},
      itemMoves: parsed.itemMoves ?? {},
      customCategories: parsed.customCategories ?? [],
      categoryFolders: parsed.categoryFolders ?? {},
      itemFolders: parsed.itemFolders ?? {},
      folderColors: parsed.folderColors ?? {},
      hiddenItemIds: parsed.hiddenItemIds ?? [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

function summarize(items: MediaItem[]): Omit<CategorySummary, "key" | "name"> {
  return {
    count: items.length,
    videoCount: items.filter((item) => item.type === "video").length,
    imageCount: items.filter((item) => item.type === "image").length,
    pdfCount: items.filter((item) => item.type === "pdf").length,
    // A PDF has no thumbnail-friendly src — every cover renderer (FolderTile,
    // FolderListRow) assumes video-or-<img>, so never hand them a PDF to render.
    cover: items.find((item) => item.type !== "pdf") ?? null,
  };
}

/**
 * Lets the gallery behave like a file manager (rename a category/folder,
 * move an item into another one, create new empty categories/folders).
 * The underlying media list (filesystem assets + imported zips) stays the
 * source of truth for *what* exists; this layer only remembers how it's
 * organized, in the browser's localStorage — except the *names* of
 * explicitly-created categories/folders, which also get durably saved to
 * the backend (server/index.mjs's `/api/categories`) so a fresh browser
 * profile still has them. Item moves, colors, and hidden items stay
 * local-only: they key off ephemeral client-side media item ids that
 * aren't meaningful to persist server-side.
 */
export function useOrganization(baseItems: MediaItem[]) {
  const [state, setState] = useState<OrgState>(loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable (e.g. private browsing) — organization
      // just won't persist across reloads.
    }
  }, [state]);

  // One-time hydration from the backend — union, never overwrite, so categories/folders
  // that already exist locally (e.g. from before this feature shipped) aren't dropped.
  useEffect(() => {
    fetchCategories()
      .then((records) => {
        setState((prev) => {
          const customCategories = Array.from(
            new Set([...prev.customCategories, ...records.map((r) => r.name)]),
          );
          const categoryFolders = { ...prev.categoryFolders };
          for (const record of records) {
            const existing = categoryFolders[record.name] ?? [];
            categoryFolders[record.name] = Array.from(
              new Set([...existing, ...record.folders]),
            );
          }
          return { ...prev, customCategories, categoryFolders };
        });
      })
      .catch(() => {
        // No backend reachable — organization still works, just local-only for this session.
      });
  }, []);

  const items = useMemo<MediaItem[]>(
    () =>
      baseItems
        .filter((item) => !state.hiddenItemIds.includes(item.id))
        .map((item) => {
          const movedTo = state.itemMoves[item.id];
          return movedTo && movedTo !== item.category
            ? { ...item, category: movedTo }
            : item;
        }),
    [baseItems, state.itemMoves, state.hiddenItemIds],
  );

  const categories = useMemo<CategorySummary[]>(() => {
    const keys = new Set<string>();
    items.forEach((item) => keys.add(item.category));
    state.customCategories.forEach((key) => keys.add(key));

    return Array.from(keys)
      .map((key) => {
        const inCategory = items.filter((item) => item.category === key);
        return {
          key,
          name: state.categoryNames[key] ?? key,
          ...summarize(inCategory),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, state.customCategories, state.categoryNames]);

  const renameCategory = useCallback((key: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      categoryNames: { ...prev.categoryNames, [key]: trimmed },
    }));
  }, []);

  /** Creates a new, initially-empty category and returns its key. */
  const createCategory = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = categories.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing.key;

      const key = trimmed;
      setState((prev) => ({
        ...prev,
        customCategories: prev.customCategories.includes(key)
          ? prev.customCategories
          : [...prev.customCategories, key],
      }));
      void createCategoryRemote(key).catch(() => {
        // Backend unreachable — the category still exists locally, just not durably yet.
      });
      return key;
    },
    [categories],
  );

  /** Moves an item to a different top-level category; clears its folder (folders are per-category). */
  const moveItem = useCallback((itemId: string, categoryKey: string) => {
    setState((prev) => {
      const nextFolders = { ...prev.itemFolders };
      delete nextFolders[itemId];
      return {
        ...prev,
        itemMoves: { ...prev.itemMoves, [itemId]: categoryKey },
        itemFolders: nextFolders,
      };
    });
  }, []);

  // --- Folders (one level inside a category) -----------------------------

  const foldersByCategory = useCallback(
    (categoryKey: string): FolderSummary[] => {
      const itemsInCategory = items.filter(
        (item) => item.category === categoryKey,
      );
      const names = new Set<string>(state.categoryFolders[categoryKey] ?? []);
      itemsInCategory.forEach((item) => {
        const folder = state.itemFolders[item.id];
        if (folder) names.add(folder);
      });

      return Array.from(names)
        .map((name) => {
          const inFolder = itemsInCategory.filter(
            (item) => state.itemFolders[item.id] === name,
          );
          return { key: name, name, ...summarize(inFolder) };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [items, state.categoryFolders, state.itemFolders],
  );

  /** Items directly in a category that haven't been filed into a folder yet. */
  const unsortedInCategory = useCallback(
    (categoryKey: string): MediaItem[] =>
      items.filter(
        (item) => item.category === categoryKey && !state.itemFolders[item.id],
      ),
    [items, state.itemFolders],
  );

  const itemsInFolder = useCallback(
    (categoryKey: string, folderName: string): MediaItem[] =>
      items.filter(
        (item) =>
          item.category === categoryKey &&
          state.itemFolders[item.id] === folderName,
      ),
    [items, state.itemFolders],
  );

  const createFolder = useCallback(
    (categoryKey: string, name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = foldersByCategory(categoryKey).find(
        (f) => f.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing.key;

      setState((prev) => {
        const current = prev.categoryFolders[categoryKey] ?? [];
        if (current.includes(trimmed)) return prev;
        return {
          ...prev,
          categoryFolders: {
            ...prev.categoryFolders,
            [categoryKey]: [...current, trimmed],
          },
        };
      });
      void createFolderRemote(categoryKey, trimmed).catch(() => {
        // Backend unreachable — the folder still exists locally, just not durably yet.
      });
      return trimmed;
    },
    [foldersByCategory],
  );

  const renameFolder = useCallback(
    (categoryKey: string, oldName: string, nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === oldName) return;

      setState((prev) => {
        const list = (prev.categoryFolders[categoryKey] ?? []).map((n) =>
          n === oldName ? trimmed : n,
        );
        const nextItemFolders = { ...prev.itemFolders };
        items.forEach((item) => {
          if (
            item.category === categoryKey &&
            nextItemFolders[item.id] === oldName
          ) {
            nextItemFolders[item.id] = trimmed;
          }
        });
        const nextColors = { ...prev.folderColors };
        const oldKey = colorKey(categoryKey, oldName);
        if (oldKey in nextColors) {
          nextColors[colorKey(categoryKey, trimmed)] = nextColors[oldKey];
          delete nextColors[oldKey];
        }
        return {
          ...prev,
          categoryFolders: { ...prev.categoryFolders, [categoryKey]: list },
          itemFolders: nextItemFolders,
          folderColors: nextColors,
        };
      });
    },
    [items],
  );

  /** Moves an item into a folder within its *current* category, or back to unsorted if folderName is null. */
  const moveItemToFolder = useCallback(
    (itemId: string, folderName: string | null) => {
      setState((prev) => {
        const nextFolders = { ...prev.itemFolders };
        if (folderName) nextFolders[itemId] = folderName;
        else delete nextFolders[itemId];
        return { ...prev, itemFolders: nextFolders };
      });
    },
    [],
  );

  /** Deletes a folder (never the media in it — its items just fall back to Unsorted). */
  const deleteFolder = useCallback(
    (categoryKey: string, folderName: string) => {
      setState((prev) => {
        const list = (prev.categoryFolders[categoryKey] ?? []).filter(
          (n) => n !== folderName,
        );
        const nextItemFolders = { ...prev.itemFolders };
        items.forEach((item) => {
          if (
            item.category === categoryKey &&
            nextItemFolders[item.id] === folderName
          ) {
            delete nextItemFolders[item.id];
          }
        });
        const nextColors = { ...prev.folderColors };
        delete nextColors[colorKey(categoryKey, folderName)];
        return {
          ...prev,
          categoryFolders: { ...prev.categoryFolders, [categoryKey]: list },
          itemFolders: nextItemFolders,
          folderColors: nextColors,
        };
      });
    },
    [items],
  );

  /** Reads the assigned color for a category, or a folder within it, if any. */
  const getFolderColor = useCallback(
    (categoryKey: string, folderName?: string | null): string | null =>
      state.folderColors[colorKey(categoryKey, folderName)] ?? null,
    [state.folderColors],
  );

  /** Assigns (or clears, with color = null) a color for a category or a folder within it. */
  const setFolderColor = useCallback(
    (categoryKey: string, folderName: string | null, color: string | null) => {
      setState((prev) => {
        const key = colorKey(categoryKey, folderName);
        const next = { ...prev.folderColors };
        if (color) next[key] = color;
        else delete next[key];
        return { ...prev, folderColors: next };
      });
    },
    [],
  );

  const FALLBACK_CATEGORY = "Uncategorized";

  /** Deletes a category (never the media in it — its items fall back to "Uncategorized"). */
  const deleteCategory = useCallback(
    (categoryKey: string) => {
      const itemsInCategory = items.filter(
        (item) => item.category === categoryKey,
      );
      if (categoryKey === FALLBACK_CATEGORY && itemsInCategory.length > 0)
        return;

      setState((prev) => {
        const nextItemMoves = { ...prev.itemMoves };
        let nextCustom = prev.customCategories.filter((k) => k !== categoryKey);
        const nextItemFolders = { ...prev.itemFolders };

        if (itemsInCategory.length > 0) {
          const fallbackExists =
            nextCustom.includes(FALLBACK_CATEGORY) ||
            items.some(
              (i) =>
                i.category === FALLBACK_CATEGORY && i.category !== categoryKey,
            );
          if (!fallbackExists) nextCustom = [...nextCustom, FALLBACK_CATEGORY];
          itemsInCategory.forEach((item) => {
            nextItemMoves[item.id] = FALLBACK_CATEGORY;
            delete nextItemFolders[item.id];
          });
        }

        const nextNames = { ...prev.categoryNames };
        delete nextNames[categoryKey];
        const nextFolders = { ...prev.categoryFolders };
        delete nextFolders[categoryKey];
        const nextColors = { ...prev.folderColors };
        delete nextColors[colorKey(categoryKey)];
        Object.keys(nextColors).forEach((key) => {
          if (key.startsWith(`${categoryKey}::`)) delete nextColors[key];
        });

        return {
          ...prev,
          itemMoves: nextItemMoves,
          customCategories: nextCustom,
          categoryNames: nextNames,
          categoryFolders: nextFolders,
          itemFolders: nextItemFolders,
          folderColors: nextColors,
        };
      });
    },
    [items],
  );

  /**
   * Hides a media item from the gallery. Never touches the underlying file —
   * for a filesystem-origin item there's nowhere to delete it *to*; for an
   * imported one, the caller (useImportedMedia) is responsible for actually
   * freeing its IndexedDB bytes once it's hidden here.
   */
  const deleteItem = useCallback((itemId: string) => {
    setState((prev) => {
      if (prev.hiddenItemIds.includes(itemId)) return prev;
      const nextItemMoves = { ...prev.itemMoves };
      delete nextItemMoves[itemId];
      const nextItemFolders = { ...prev.itemFolders };
      delete nextItemFolders[itemId];
      return {
        ...prev,
        hiddenItemIds: [...prev.hiddenItemIds, itemId],
        itemMoves: nextItemMoves,
        itemFolders: nextItemFolders,
      };
    });
  }, []);

  return {
    items,
    categories,
    renameCategory,
    createCategory,
    moveItem,
    foldersByCategory,
    unsortedInCategory,
    itemsInFolder,
    createFolder,
    renameFolder,
    moveItemToFolder,
    deleteFolder,
    deleteCategory,
    deleteItem,
    getFolderColor,
    setFolderColor,
  };
}
