import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie, MovieAspect } from "@/types/movie";
import { normalizeMovie } from "@/lib/movieRender";
import {
  createMovie,
  deleteMovie,
  fetchMovies,
  updateMovie,
  type MoviePatch,
} from "@/lib/api/movies";

const SAVE_DEBOUNCE_MS = 600;

/** Movie projects, backed by the Node API in `server/`. Create/delete go to the server
 * immediately; everything else (clips, header/footer, title) updates local state right
 * away and saves on a short per-movie debounce, like Tasks — a timeline gets a lot of
 * small edits (slider drags, dialogue typing) that shouldn't each fire a request. */
export function useMovies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const saveTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, MoviePatch>>(new Map());

  useEffect(() => {
    fetchMovies()
      .then((fetched) => setMovies(fetched.map(normalizeMovie)))
      .catch(() => {
        // No backend reachable yet — movies just stays empty until it is.
      });
  }, []);

  const addMovie = useCallback(async (title: string, aspect: MovieAspect) => {
    const trimmed = title.trim();
    if (!trimmed) return null;
    const movie = await createMovie(trimmed, aspect);
    setMovies((prev) => [normalizeMovie(movie), ...prev]);
    return movie.id;
  }, []);

  const flushMovie = useCallback((id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    pendingPatches.current.delete(id);
    void updateMovie(id, patch).catch(() => {});
  }, []);

  const patchMovie = useCallback(
    (id: string, patch: MoviePatch) => {
      setMovies((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m,
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
        window.setTimeout(() => flushMovie(id), SAVE_DEBOUNCE_MS),
      );
    },
    [flushMovie],
  );

  const removeMovie = useCallback(async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimers.current.delete(id);
    pendingPatches.current.delete(id);
    await deleteMovie(id);
    setMovies((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { movies, addMovie, patchMovie, flushMovie, removeMovie };
}
