import { useState } from "react";
import type { BookPage } from "@/types/book";
import type { MediaItem } from "@/types/media";
import { BookPageElements } from "@/components/BookPageElements";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

type Props = {
  pages: BookPage[];
  mediaItems: MediaItem[];
};

/**
 * Read-only page-by-page viewer with a page-turn animation — two stacked layers (the
 * target page static underneath, the current page on top rotating away on its hinge via
 * CSS `rotateY` + `backfaceVisibility: hidden`) instead of a flip-book dependency. The top
 * layer is keyed by page id so it remounts at rest (no transition) once the flip finishes,
 * rather than animating back from the flipped-away angle.
 */
export function BookReader({ pages, mediaItems }: Props) {
  const [index, setIndex] = useState(0);
  const [flipping, setFlipping] = useState<"next" | "prev" | null>(null);

  const current = pages[index];
  const targetIndex =
    flipping === "next" ? index + 1 : flipping === "prev" ? index - 1 : null;
  const target = targetIndex !== null ? pages[targetIndex] : null;

  const goNext = () => {
    if (flipping || index >= pages.length - 1) return;
    setFlipping("next");
  };
  const goPrev = () => {
    if (flipping || index <= 0) return;
    setFlipping("prev");
  };
  const handleTransitionEnd = () => {
    if (flipping === "next") setIndex((i) => i + 1);
    else if (flipping === "prev") setIndex((i) => i - 1);
    setFlipping(null);
  };

  if (!current) {
    return (
      <p className="py-20 text-center text-sm text-neutral-400">
        This book has no pages yet.
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden bg-canvas py-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0 || flipping !== null}
          aria-label="Previous page"
          className="flex size-9 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/5 transition hover:bg-linen-hover disabled:opacity-30"
        >
          <ChevronLeftIcon className="size-4" />
        </button>

        <div
          className="relative aspect-[3/4] h-[78vh] max-h-[860px] rounded-sm shadow-xl ring-1 ring-black/10"
          style={{ perspective: "1800px" }}
        >
          {target && (
            <div className="absolute inset-0 overflow-hidden rounded-sm">
              <BookPageElements page={target} mediaItems={mediaItems} />
            </div>
          )}
          <div
            key={current.id}
            onTransitionEnd={handleTransitionEnd}
            className="absolute inset-0 overflow-hidden rounded-sm transition-transform duration-200 ease-in-out"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              transformOrigin:
                flipping === "next" ? "left center" : "right center",
              transform:
                flipping === "next"
                  ? "rotateY(-150deg)"
                  : flipping === "prev"
                    ? "rotateY(150deg)"
                    : "rotateY(0deg)",
            }}
          >
            <BookPageElements page={current} mediaItems={mediaItems} />
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={index === pages.length - 1 || flipping !== null}
          aria-label="Next page"
          className="flex size-9 items-center justify-center rounded-full bg-white shadow ring-1 ring-black/5 transition hover:bg-linen-hover disabled:opacity-30"
        >
          <ChevronRightIcon className="size-4" />
        </button>
      </div>

      <p className="text-xs text-neutral-400">
        Page {index + 1} of {pages.length}
      </p>
    </div>
  );
}
