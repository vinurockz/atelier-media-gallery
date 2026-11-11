export type BookElementType = "text" | "image" | "shape";
export type BookTextAlign = "left" | "center" | "right";
export type BookFontFamily = "sans" | "serif" | "mono";
export type BookShapeKind = "rectangle" | "ellipse" | "line";

/** 0-1 fractions of the *natural, uncropped* image — not the element's on-page box. */
export interface BookCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One item placed on a page — position/size are 0-1 fractions of the page box, so a page
 * renders the same relative layout at any zoom/export size (same non-destructive-metadata
 * idea as the Editor module's CropRect). `height`/`rotation`/`fontFamily`/`crop`/
 * `shapeKind`/`fillColor` were added after some elements may already exist, so they're
 * optional here and defaulted at the point of use rather than assumed present. */
export interface BookElement {
  id: string;
  type: BookElementType;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  text: string;
  fontSize: number;
  fontFamily?: BookFontFamily;
  color: string;
  bold: boolean;
  italic: boolean;
  align: BookTextAlign;
  mediaItemId: string | null;
  crop?: BookCropRect | null;
  shapeKind?: BookShapeKind | null;
  fillColor?: string;
}

export interface BookPage {
  id: string;
  bookId: string;
  index: number;
  background: string;
  elements: BookElement[];
}

export interface Book {
  id: string;
  title: string;
  coverColor: string;
  /** Max pages, or null for no limit. */
  pageLimit: number | null;
  pageCount: number;
  createdAt: number;
  updatedAt: number;
}
