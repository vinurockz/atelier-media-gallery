import type { Movie, MovieAspect } from "@/types/movie";
import { request } from "@/lib/api/request";

/** A slideshow is stored exactly like a Movie (own collection, same shape) — see
 * server/index.mjs's slideshow routes and MovieWorkspace, which edits both the same way. */
export function fetchSlideshows(): Promise<Movie[]> {
  return request<Movie[]>("/slideshows");
}

export function createSlideshow(
  title: string,
  aspect: MovieAspect,
): Promise<Movie> {
  return request<Movie>("/slideshows", {
    method: "POST",
    body: JSON.stringify({ title, aspect }),
  });
}

export type SlideshowPatch = Partial<
  Pick<Movie, "title" | "aspect" | "background" | "header" | "footer" | "clips">
>;

export function updateSlideshow(
  id: string,
  patch: SlideshowPatch,
): Promise<Movie> {
  return request<Movie>(`/slideshows/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteSlideshow(id: string): Promise<void> {
  return request<void>(`/slideshows/${id}`, { method: "DELETE" });
}
