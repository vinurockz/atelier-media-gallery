import type { BookPage } from "@/types/book";
import type { MediaItem } from "@/types/media";
import { BookPageElements } from "@/components/BookPageElements";

type Props = {
  pages: BookPage[];
  mediaItems: MediaItem[];
};

/**
 * Hidden off-screen until print — "Export PDF" calls `window.print()`, and the
 * `print-area` class (see `@media print` in src/styles/index.css) makes this the only
 * thing visible. Each `.book-print-page` forces a page break after it, so printing/
 * Save-as-PDF turns out one PDF page per book page — no PDF library needed.
 */
export function BookPrintPages({ pages, mediaItems }: Props) {
  return (
    <div className="print-area hidden print:block">
      {pages.map((page) => (
        <div
          key={page.id}
          className="book-print-page"
          style={{ width: "100%", height: "100vh" }}
        >
          <BookPageElements page={page} mediaItems={mediaItems} />
        </div>
      ))}
    </div>
  );
}
