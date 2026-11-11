import type { Movie, MovieAspect } from "@/types/movie";
import { request } from "@/lib/api/request";

export function fetchMovies(): Promise<Movie[]> {
  return request<Movie[]>("/movies");
}

export function createMovie(
  title: string,
  aspect: MovieAspect,
): Promise<Movie> {
  return request<Movie>("/movies", {
    method: "POST",
    body: JSON.stringify({ title, aspect }),
  });
}

export type MoviePatch = Partial<
  Pick<Movie, "title" | "aspect" | "background" | "header" | "footer" | "clips">
>;

export function updateMovie(id: string, patch: MoviePatch): Promise<Movie> {
  return request<Movie>(`/movies/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteMovie(id: string): Promise<void> {
  return request<void>(`/movies/${id}`, { method: "DELETE" });
}
