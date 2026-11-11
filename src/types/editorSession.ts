export type EditorSessionStatus = "draft" | "completed";

/** Tracks one "I'm editing/edited this photo or video" entry in the Editor module's
 * history — not the edit itself (layers/crop/adjustments live only in the open editor's
 * component state), just which source item is in progress or done, so the Images/Videos
 * blocks can show drafts and completed edits with delete. */
export interface EditorSession {
  id: string;
  mediaType: "image" | "video";
  sourceItemId: string;
  status: EditorSessionStatus;
  /** Set once completed — the MediaItem id of the newly saved file. */
  resultItemId: string | null;
  createdAt: number;
  updatedAt: number;
}
