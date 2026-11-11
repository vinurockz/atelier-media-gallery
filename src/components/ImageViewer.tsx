import { useEffect, useRef, useState } from "react";
import { CollapseIcon, ExpandIcon } from "@/components/icons";

interface ImageViewerProps {
  src: string;
  title: string;
}

/** Mirrors VideoPlayer's toolbar so images and videos feel like one system. */
export function ImageViewer({ src, title }: ImageViewerProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === imgRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const img = imgRef.current;
    if (!img) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await img.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed", err);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="truncate text-sm font-medium text-white/90">{title}</p>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {isFullscreen ? (
            <CollapseIcon className="size-4" />
          ) : (
            <ExpandIcon className="size-4" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? "Exit" : "Full screen"}
          </span>
        </button>
      </div>
      <img
        ref={imgRef}
        src={src}
        alt={title}
        className="max-h-[75vh] w-full bg-black object-contain"
      />
    </div>
  );
}
