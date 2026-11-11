import { useCallback, useEffect, useState } from "react";
import type { BookElement, BookPage } from "@/types/book";
import {
  createBookPage,
  deleteBookPage,
  fetchBookPages,
  updateBookPage,
} from "@/lib/api/books";

/** A single open book's pages. Element moves/edits are committed as one `PUT` per change
 * (on drag release, not per pointermove frame) — same "local state during the gesture, one
 * commit when it ends" split the Editor module's layer dragging uses. */
export function useBookPages(
  bookId: string | null,
  onPageCountChange: (delta: number) => void,
) {
  const [pages, setPages] = useState<BookPage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPages([]);
    setLoaded(false);
    if (!bookId) return;
    fetchBookPages(bookId)
      .then((p) => {
        setPages(p);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [bookId]);

  const addPage = useCallback(async () => {
    if (!bookId) return null;
    try {
      const page = await createBookPage(bookId);
      setPages((prev) => [...prev, page]);
      onPageCountChange(1);
      return page.id;
    } catch {
      return null;
    }
  }, [bookId, onPageCountChange]);

  const updatePage = useCallback(
    async (
      pageId: string,
      patch: { background?: string; elements?: BookElement[] },
    ) => {
      if (!bookId) return;
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
      );
      await updateBookPage(bookId, pageId, patch).catch(() => {});
    },
    [bookId],
  );

  const removePage = useCallback(
    async (pageId: string) => {
      if (!bookId) return;
      await deleteBookPage(bookId, pageId).catch(() => {});
      // The server renumbers remaining pages' `index` on delete — refetch instead of
      // reimplementing that reindex logic client-side.
      const fresh = await fetchBookPages(bookId).catch(() => null);
      if (fresh) setPages(fresh);
      onPageCountChange(-1);
    },
    [bookId, onPageCountChange],
  );

  return { pages, loaded, addPage, updatePage, removePage };
}
