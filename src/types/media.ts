export type MediaType = "video" | "image" | "pdf";

/** Named color buckets used for the color filter. */
export type ColorName =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "white"
  | "gray"
  | "black";

export interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  category: string;
  src: string;
  /** Bytes, when already known (imported items know it immediately; bundled assets fetch it lazily — see useMediaSizes). */
  size?: number;
  /** When the item was imported. Bundled assets don't have a real "uploaded" time, so this is omitted for them. */
  addedAt?: number;
}
