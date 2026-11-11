import { useCallback, useEffect, useState } from "react";
import type { Book } from "@/types/book";
import {
  createBook,
  deleteBook,
  fetchBooks,
  updateBook,
  type BookPatch,
} from "@/lib/api/books";

/** Book list (not pages — see useBookPages for a single open book's pages), backed by the
 * Node API in `server/` the same way as Bills/Notes/Contents. */
export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    fetchBooks()
      .then(setBooks)
      .catch(() => {
        // No backend reachable yet — books just stays empty until it is.
      });
  }, []);

  const addBook = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const book = await createBook(trimmed);
    setBooks((prev) => [book, ...prev]);
    return book.id;
  }, []);

  const editBook = useCallback(async (id: string, patch: BookPatch) => {
    const updated = await updateBook(id, patch);
    setBooks((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }, []);

  const removeBook = useCallback(async (id: string) => {
    await deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Pulled in from useBookPages when a page is added/removed, so the book tile's page
  // count stays right without a full refetch.
  const bumpPageCount = useCallback((id: string, delta: number) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, pageCount: b.pageCount + delta } : b,
      ),
    );
  }, []);

  return { books, addBook, editBook, removeBook, bumpPageCount };
}
