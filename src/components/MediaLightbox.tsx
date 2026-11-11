import { useEffect, useState } from "react";
import type { MediaItem } from "@/types/media";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ImageViewer } from "@/components/ImageViewer";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/icons";

const SLIDESHOW_INTERVAL_MS = 4000;

interface MediaLightboxProps {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function MediaLightbox({
  items,
  index,
  onClose,
  onNavigate,
}: MediaLightboxProps) {
  const item = items[index];
  const [slideshow, setSlideshow] = useState(false);
  const canSlideshow = item?.type === "image" && items.length > 1;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((index + 1) % items.length);
      if (e.key === "ArrowLeft")
        onNavigate((index - 1 + items.length) % items.length);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [index, items.length, onClose, onNavigate]);

  useEffect(() => {
    if (!slideshow || !canSlideshow) return;
    const id = window.setInterval(() => {
      onNavigate((index + 1) % items.length);
    }, SLIDESHOW_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slideshow, canSlideshow, index, items.length, onNavigate]);

  useEffect(() => {
    if (!canSlideshow) setSlideshow(false);
  }, [canSlideshow]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <CloseIcon className="size-5" />
      </button>

      {canSlideshow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSlideshow((p) => !p);
          }}
          aria-pressed={slideshow}
          title={slideshow ? "Pause slideshow" : "Play slideshow"}
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {slideshow ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
          {slideshow ? "Pause" : "Slideshow"}
        </button>
      )}

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() =>
              onNavigate((index - 1 + items.length) % items.length)
            }
            aria-label="Previous"
            className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:left-4"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate((index + 1) % items.length)}
            aria-label="Next"
            className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:right-4"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </>
      )}

      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        {item.type === "video" ? (
          <VideoPlayer
            key={item.id}
            src={item.src}
            title={item.title}
            autoPlay
          />
        ) : item.type === "pdf" ? (
          // Defensive — this lightbox is video/image by design; every picker
          // that feeds it already excludes PDFs (use the PDFs module to open
          // one), so this is just a safe fallback rather than a broken <img>.
          <p className="py-10 text-center text-sm text-white/70">
            Open PDFs from the PDFs module to view and highlight them.
          </p>
        ) : (
          <ImageViewer key={item.id} src={item.src} title={item.title} />
        )}
        <p className="mt-3 text-center text-sm text-white/60">
          {item.category} · {index + 1} of {items.length}
        </p>
      </div>
    </div>
  );
}
