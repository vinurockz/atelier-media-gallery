/** One rectangle of a highlighted text selection, 0-1 relative to the page's rendered
 * size — same non-destructive, resolution-independent convention as CropRect/BookElement,
 * so a highlight still lines up correctly at any zoom level. A multi-line selection
 * produces one rect per line. */
export interface HighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A saved text highlight on one page of a stored PDF. */
export interface PdfHighlight {
  id: string;
  mediaItemId: string;
  /** 1-indexed. */
  page: number;
  rects: HighlightRect[];
  /** Raw hex. */
  color: string;
  /** The highlighted text itself, kept for reference/search — not re-derived from rects. */
  text: string;
  createdAt: number;
}
