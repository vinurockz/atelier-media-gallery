import { useState } from "react";
import type { Movie, MovieAspect, MovieClip } from "@/types/movie";
import type { MediaItem } from "@/types/media";
import type { CategorySummary } from "@/hooks/useOrganization";
import type { SlideshowPatch } from "@/lib/api/slideshows";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { MovieWorkspace } from "@/components/MovieWorkspace";
import { NewSlideshowModal } from "@/components/NewSlideshowModal";
import { ImagesIcon, PlusIcon, TrashIcon } from "@/components/icons";

type Props = {
  slideshows: Movie[];
  mediaItems: MediaItem[];
  categories: CategorySummary[];
  onCreate: (title: string, aspect: MovieAspect) => Promise<string | null>;
  onPatch: (id: string, patch: SlideshowPatch) => void;
  onFlush: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveExport: (file: File) => Promise<MediaItem | null>;
  onEditMedia: (source: MediaItem, file: File) => Promise<MediaItem | null>;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

/** Grid of slideshow projects — a guided alternative to Movies: pick a category's worth of
 * images/videos (or add individually/upload), choose one transition style and a default
 * seconds-per-slide, and the rest of editing/export happens in the same MovieWorkspace
 * Movies uses (a slideshow is just a Movie, stored in its own collection). */
export function SlideshowsView({
  slideshows,
  mediaItems,
  categories,
  onCreate,
  onPatch,
  onFlush,
  onDelete,
  onSaveExport,
  onEditMedia,
  onImportFiles,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const openSlideshow = openId
    ? (slideshows.find((s) => s.id === openId) ?? null)
    : null;

  const closeWorkspace = () => {
    if (openId) onFlush(openId);
    setOpenId(null);
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Delete "${title}"? This can't be undone.`)) {
      if (openId === id) setOpenId(null);
      onDelete(id);
    }
  };

  const handleCreate = async (
    title: string,
    aspect: MovieAspect,
    clips: MovieClip[],
  ) => {
    const id = await onCreate(title, aspect);
    if (!id) return;
    onPatch(id, { clips });
    onFlush(id);
    setShowNew(false);
    setOpenId(id);
  };

  if (openSlideshow) {
    return (
      <MovieWorkspace
        movie={openSlideshow}
        mediaItems={mediaItems}
        onBack={closeWorkspace}
        onPatch={(patch) => onPatch(openSlideshow.id, patch)}
        onDelete={() => handleDelete(openSlideshow.id, openSlideshow.title)}
        onSaveExport={onSaveExport}
        onEditMedia={onEditMedia}
        onImportFiles={onImportFiles}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <ImagesIcon className="size-4 text-stone" />
          <h1 className="text-base font-medium text-ink">Slideshow</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
        >
          <PlusIcon className="size-3.5" />
          New slideshow
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        {slideshows.length === 0 && (
          <p className="mb-4 text-sm text-stone">
            Pick a category's worth of images/videos (or add your own), choose a
            transition style and a default seconds-per-slide, then fine-tune or
            export from the timeline that opens.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {slideshows.map((slideshow) => (
            <div key={slideshow.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpenId(slideshow.id)}
                className="flex aspect-video w-full flex-col justify-end overflow-hidden rounded-lg bg-neutral-900 text-left ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-1 items-center justify-center text-neutral-600">
                  <ImagesIcon className="size-8" />
                </div>
                <div className="bg-black/40 px-2 py-2">
                  <p className="truncate text-xs font-semibold text-white">
                    {slideshow.title}
                  </p>
                  <p className="text-[10px] text-white/70">
                    {slideshow.clips.length}{" "}
                    {slideshow.clips.length === 1 ? "slide" : "slides"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(slideshow.id, slideshow.title)}
                aria-label="Delete slideshow"
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showNew && (
        <NewSlideshowModal
          categories={categories}
          mediaItems={mediaItems}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
          onImportFiles={onImportFiles}
        />
      )}
    </div>
  );
}
