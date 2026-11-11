import { useState } from "react";
import type { Movie } from "@/types/movie";
import type { MediaItem } from "@/types/media";
import type { MoviePatch } from "@/lib/api/movies";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { MovieWorkspace } from "@/components/MovieWorkspace";
import { NewFolderTile } from "@/components/NewFolderTile";
import { ClapperboardIcon, TrashIcon } from "@/components/icons";

type Props = {
  movies: Movie[];
  mediaItems: MediaItem[];
  onCreate: (title: string) => Promise<string | null>;
  onPatchMovie: (id: string, patch: MoviePatch) => void;
  onFlushMovie: (id: string) => void;
  onDeleteMovie: (id: string) => void;
  onSaveExport: (file: File) => Promise<MediaItem | null>;
  /** Saves an edited version of an object's own image as a new file, same as the Editor module. */
  onEditMedia: (source: MediaItem, file: File) => Promise<MediaItem | null>;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

/** Grid of movie projects — mirrors the Books module's tile grid. Clicking one opens
 * MovieWorkspace, its timeline editor. */
export function MoviesView({
  movies,
  mediaItems,
  onCreate,
  onPatchMovie,
  onFlushMovie,
  onDeleteMovie,
  onSaveExport,
  onEditMedia,
  onImportFiles,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openMovie = openId
    ? (movies.find((m) => m.id === openId) ?? null)
    : null;

  const closeWorkspace = () => {
    if (openId) onFlushMovie(openId);
    setOpenId(null);
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Delete "${title}"? This can't be undone.`)) {
      if (openId === id) setOpenId(null);
      onDeleteMovie(id);
    }
  };

  if (openMovie) {
    return (
      <MovieWorkspace
        movie={openMovie}
        mediaItems={mediaItems}
        onBack={closeWorkspace}
        onPatch={(patch) => onPatchMovie(openMovie.id, patch)}
        onDelete={() => handleDelete(openMovie.id, openMovie.title)}
        onSaveExport={onSaveExport}
        onEditMedia={onEditMedia}
        onImportFiles={onImportFiles}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <ClapperboardIcon className="size-4 text-stone" />
        <h1 className="text-base font-medium text-ink">Movies</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        {movies.length === 0 && (
          <p className="mb-4 text-sm text-stone">
            Create a movie, then add clips, animation, headers/footers, and
            dialogue from its timeline.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {movies.map((movie) => (
            <div key={movie.id} className="group relative">
              <button
                type="button"
                onClick={() => setOpenId(movie.id)}
                className="flex aspect-video w-full flex-col justify-end overflow-hidden rounded-lg bg-neutral-900 text-left ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-1 items-center justify-center text-neutral-600">
                  <ClapperboardIcon className="size-8" />
                </div>
                <div className="bg-black/40 px-2 py-2">
                  <p className="truncate text-xs font-semibold text-white">
                    {movie.title}
                  </p>
                  <p className="text-[10px] text-white/70">
                    {movie.clips.length}{" "}
                    {movie.clips.length === 1 ? "clip" : "clips"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(movie.id, movie.title)}
                aria-label="Delete movie"
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
          ))}
          <NewFolderTile label="New movie" onCreate={onCreate} />
        </div>
      </div>
    </div>
  );
}
