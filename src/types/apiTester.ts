export type HttpMethod =
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type ApiBodyType = "none" | "json" | "text";

export interface ApiHeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

/** How a response body got interpreted, driven by its Content-Type. */
export type ApiBodyKind =
  "json" | "text" | "image" | "video" | "audio" | "binary" | "empty";

export interface ApiResponseResult {
  status: number;
  statusText: string;
  ok: boolean;
  headers: { key: string; value: string }[];
  timeMs: number;
  sizeBytes: number | null;
  contentType: string;
  bodyKind: ApiBodyKind;
  /** Raw text, present for "json" and "text" bodies. */
  bodyText: string | null;
  /** Pretty-printed (2-space) JSON, present only for "json" bodies. */
  jsonText: string | null;
  /** Object URL for "image"/"video"/"audio"/"binary" bodies — caller must revoke it. */
  objectUrl: string | null;
  fileName: string;
}

/** One past request, kept purely client-side (localStorage) — same "activity, not
 * durable content" reasoning as the Editor module's EditorSession. */
export interface ApiHistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  headers: ApiHeaderRow[];
  bodyType: ApiBodyType;
  body: string;
  createdAt: number;
}
