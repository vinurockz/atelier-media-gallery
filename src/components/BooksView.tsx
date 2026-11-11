import { useState } from "react";
import type { Book } from "@/types/book";
import type { MediaItem } from "@/types/media";
import type { BookPatch } from "@/lib/api/books";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { BookWorkspace } from "@/components/BookWorkspace";
import { NewFolderTile } from "@/components/NewFolderTile";
import { BookIcon, TrashIcon } from "@/components/icons";

type Props = {
  books: Book[];
  mediaItems: MediaItem[];
  onCreate: (title: string) => Promise<string | null>;
  onEditBook: (id: string, patch: BookPatch) => Promise<void>;
  onDeleteBook: (id: string) => void;
  onBumpPageCount: (id: string, delta: number) => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

/** Grid of books — mirrors the Files/Chat/Bills module tile grids. Clicking one opens
 * BookWorkspace, where its pages live (fetched lazily, not here). */
export function BooksView({
  books,
  mediaItems,
  onCreate,
  onEditBook,
  onDeleteBook,
  onBumpPageCount,
  onImportFiles,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openBook = openId ? (books.find((b) => b.id === openId) ?? null) : null;

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Delete "${title}"? Its pages will be deleted too.`)) {
      if (openId === id) setOpenId(null);
      onDeleteBook(id);
    }
  };

  if (openBook) {
    return (
      <BookWorkspace
        book={openBook}
        mediaItems={mediaItems}
        onBack={() => setOpenId(null)}
        onEditBook={(patch) => onEditBook(openBook.id, patch)}
        onDeleteBook={() => handleDelete(openBook.id, openBook.title)}
        onBumpPageCount={(delta) => onBumpPageCount(openBook.id, delta)}
        onImportFiles={onImportFiles}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <BookIcon className="size-4 text-stone" />
        <h1 className="text-base font-medium text-ink">Books</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {books.map((book) => (
            <div key={book.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpenId(book.id)}
                className="flex aspect-[3/4] w-full flex-col justify-end overflow-hidden rounded-lg text-left ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: book.coverColor }}
              >
                <div className="flex-1" />
                <div className="bg-black/25 px-2 py-2">
                  <p className="truncate text-xs font-semibold text-white">
                    {book.title}
                  </p>
                  <p className="text-[10px] text-white/80">
                    {book.pageCount} {book.pageCount === 1 ? "page" : "pages"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(book.id, book.title)}
                aria-label="Delete book"
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          ))}
          <NewFolderTile label="New book" onCreate={onCreate} />
        </div>
      </div>
    </div>
  );
}
