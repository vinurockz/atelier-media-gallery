import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie, MovieAspect } from "@/types/movie";
import { normalizeMovie } from "@/lib/movieRender";
import {
  createSlideshow,
  deleteSlideshow,
  fetchSlideshows,
  updateSlideshow,
  type SlideshowPatch,
} from "@/lib/api/slideshows";

const SAVE_DEBOUNCE_MS = 600;

/** Slideshow projects — backed by the Node API in `server/`, same model as useMovies (own
 * collection, own debounced-save hook), since a slideshow's underlying document is a Movie. */
export function useSlideshows() {
  const [slideshows, setSlideshows] = useState<Movie[]>([]);
  const saveTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, SlideshowPatch>>(new Map());

  useEffect(() => {
    fetchSlideshows()
      .then((fetched) => setSlideshows(fetched.map(normalizeMovie)))
      .catch(() => {
        // No backend reachable yet — slideshows just stays empty until it is.
      });
  }, []);

  const addSlideshow = useCallback(
    async (title: string, aspect: MovieAspect) => {
      const trimmed = title.trim();
      if (!trimmed) return null;
      const slideshow = await createSlideshow(trimmed, aspect);
      setSlideshows((prev) => [normalizeMovie(slideshow), ...prev]);
      return slideshow.id;
    },
    [],
  );

  const flushSlideshow = useCallback((id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    pendingPatches.current.delete(id);
    void updateSlideshow(id, patch).catch(() => {});
  }, []);

  const patchSlideshow = useCallback(
    (id: string, patch: SlideshowPatch) => {
      setSlideshows((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
        ),
      );
      pendingPatches.current.set(id, {
        ...pendingPatches.current.get(id),
        ...patch,
      });
      const timer = saveTimers.current.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      saveTimers.current.set(
        id,
        window.setTimeout(() => flushSlideshow(id), SAVE_DEBOUNCE_MS),
      );
    },
    [flushSlideshow],
  );

  const removeSlideshow = useCallback(async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimers.current.delete(id);
    pendingPatches.current.delete(id);
    await deleteSlideshow(id);
    setSlideshows((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    slideshows,
    addSlideshow,
    patchSlideshow,
    flushSlideshow,
    removeSlideshow,
  };
}
