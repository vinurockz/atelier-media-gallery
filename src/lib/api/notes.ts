import type { Note } from "@/types/notes";
import { request } from "@/lib/api/request";

export function fetchNotes(): Promise<Note[]> {
  return request<Note[]>("/notes");
}

export function createNote(title: string): Promise<Note> {
  return request<Note>("/notes", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export type NotePatch = Partial<
  Pick<Note, "title" | "color" | "pinned" | "blocks">
>;

export function updateNote(id: string, patch: NotePatch): Promise<Note> {
  return request<Note>(`/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteNote(id: string): Promise<void> {
  return request<void>(`/notes/${id}`, { method: "DELETE" });
}
