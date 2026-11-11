import { useEffect, useState } from "react";
import type { Book } from "@/types/book";
import type { MediaItem } from "@/types/media";
import type { BookPatch } from "@/lib/api/books";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { useBookPages } from "@/hooks/useBookPages";
import { BookPageCanvas } from "@/components/BookPageCanvas";
import { BookReader } from "@/components/BookReader";
import { BookPrintPages } from "@/components/BookPrintPages";
import {
  ChevronLeftIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  book: Book;
  mediaItems: MediaItem[];
  onBack: () => void;
  onEditBook: (patch: BookPatch) => Promise<void>;
  onDeleteBook: () => void;
  onBumpPageCount: (delta: number) => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

/** One open book: a page rail on the left (numbered, front/back cover included — they're
 * just the first/last pages, no special data shape), an Edit/Read mode toggle, and the
 * edit canvas or the flip-animated reader on the right. */
export function BookWorkspace({
  book,
  mediaItems,
  onBack,
  onEditBook,
  onDeleteBook,
  onBumpPageCount,
  onImportFiles,
}: Props) {
  const { pages, loaded, addPage, updatePage, removePage } = useBookPages(
    book.id,
    onBumpPageCount,
  );
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "read">("edit");
  const [addPageError, setAddPageError] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState(
    book.pageLimit?.toString() ?? "",
  );

  useEffect(() => {
    if (
      loaded &&
      pages.length > 0 &&
      !pages.some((p) => p.id === currentPageId)
    ) {
      setCurrentPageId(pages[0].id);
    }
  }, [loaded, pages, currentPageId]);

  const currentPage = pages.find((p) => p.id === currentPageId) ?? null;

  const handleAddPage = async () => {
    setAddPageError(null);
    const id = await addPage();
    if (id) setCurrentPageId(id);
    else
      setAddPageError(
        book.pageLimit
          ? `Page limit (${book.pageLimit}) reached.`
          : "Couldn't add page.",
      );
  };

  const handleDeletePage = async (pageId: string) => {
    if (!window.confirm("Delete this page?")) return;
    await removePage(pageId);
    if (currentPageId === pageId) setCurrentPageId(null);
  };

  const saveLimit = async () => {
    const trimmed = limitDraft.trim();
    await onEditBook({
      pageLimit: trimmed ? Math.max(1, Math.round(Number(trimmed))) : null,
    });
    setEditingLimit(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6 print:hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to books"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-ink"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <h2 className="truncate text-sm font-medium text-ink">
            {book.title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {editingLimit ? (
            <div className="flex items-center gap-1 rounded-full bg-canvas px-2 py-1 ring-1 ring-linen">
              <input
                type="number"
                min={1}
                value={limitDraft}
                onChange={(e) => setLimitDraft(e.target.value)}
                placeholder="No limit"
                className="w-16 bg-transparent text-xs outline-none"
              />
              <button
                type="button"
                onClick={saveLimit}
                className="text-xs font-medium text-accent"
              >
                Set
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLimitDraft(book.pageLimit?.toString() ?? "");
                setEditingLimit(true);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover"
            >
              {book.pageLimit
                ? `Limit: ${book.pageLimit} pages`
                : "No page limit"}
            </button>
          )}

          <div className="flex items-center rounded-full bg-canvas p-1 ring-1 ring-linen">
            {(["edit", "read"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                  mode === m ? "bg-white text-accent shadow-sm" : "text-stone"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover hover:text-ink"
          >
            <PrinterIcon className="size-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={onDeleteBook}
            title="Delete book"
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-40 shrink-0 flex-col gap-2 overflow-y-auto border-r border-linen bg-white px-3 py-3 print:hidden">
          {pages.map((page, i) => (
            <div key={page.id} className="group relative">
              <button
                type="button"
                onClick={() => setCurrentPageId(page.id)}
                className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-md text-xs font-medium ring-1 transition ${
                  currentPageId === page.id
                    ? "ring-2 ring-accent"
                    : "ring-black/10 hover:ring-accent/40"
                }`}
                style={{ backgroundColor: page.background }}
              >
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] text-neutral-700">
                  {i === 0
                    ? "Cover"
                    : i === pages.length - 1 && pages.length > 1
                      ? "Back"
                      : i + 1}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDeletePage(page.id)}
                aria-label="Delete page"
                className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
              >
                <TrashIcon className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddPage}
            disabled={book.pageLimit !== null && pages.length >= book.pageLimit}
            className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-neutral-300 text-neutral-400 transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon className="size-4" />
          </button>
          {addPageError && (
            <p className="text-center text-[10px] text-red-500">
              {addPageError}
            </p>
          )}
        </div>

        {mode === "edit" ? (
          currentPage ? (
            <BookPageCanvas
              page={currentPage}
              mediaItems={mediaItems}
              onChangeElements={(elements) =>
                updatePage(currentPage.id, { elements })
              }
              onChangeBackground={(background) =>
                updatePage(currentPage.id, { background })
              }
              onImportFiles={onImportFiles}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
              {loaded ? "Add a page to get started." : "Loading…"}
            </div>
          )
        ) : (
          <BookReader pages={pages} mediaItems={mediaItems} />
        )}
      </div>

      <BookPrintPages pages={pages} mediaItems={mediaItems} />
    </div>
  );
}
