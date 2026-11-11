import type { Adjustments, DrawStroke } from "@/lib/canvasDraw";

/**
 * Canvas's native compositing modes, used as-is (no translation needed) — these are the same
 * names Photoshop/Photopea use for layer blend modes.
 */
export type LayerBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "difference"
  | "hard-light";

/** A drop shadow behind a layer — Photoshop/Photopea-style layer effect. */
export interface LayerShadow {
  enabled: boolean;
  color: string;
  /** px, at the canvas's native (export) resolution. */
  blur: number;
  offsetX: number;
  offsetY: number;
}

/** A draggable overlay on the image editor's canvas. */
export interface EditorLayer {
  id: string;
  kind: "text" | "bubble" | "sticker" | "rect" | "ellipse" | "line" | "image";
  /** The text (or emoji, for a sticker) this layer holds. Unused for shapes and images. */
  text: string;
  /** Image kind: data URL of the imported picture. */
  src?: string;
  /** Image kind: height / width of the picture. */
  aspect?: number;
  /** Relative center position within the photo area, 0-1. */
  x: number;
  y: number;
  /** Pixels, at the canvas's native (export) resolution. For a shape, its size. */
  fontSize: number;
  /** Text kind: fill color. Bubble/shape kind: text/fill color. */
  color: string;
  /** Text kind: outline color. Bubble/shape kind: bubble/stroke color. */
  strokeColor: string;
  /** 0-1. Defaults to 1 (opaque) when absent, for layers saved before this field existed. */
  opacity: number;
  /** Defaults to "normal" when absent, for layers saved before this field existed. */
  blendMode?: LayerBlendMode;
  /** Defaults to disabled when absent, for layers saved before this field existed. */
  shadow?: LayerShadow;
}

/** A colored strip around the photo, with its own text. */
export interface EditorBand {
  enabled: boolean;
  text: string;
  /** Thickness in px: height for top/bottom sections, width for side sections. */
  size: number;
  background: string;
  color: string;
  fontSize: number;
  /** CSS font-family value. */
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  align: "left" | "center" | "right";
  /** Pixels; 0 means no border. */
  borderWidth: number;
  borderColor: string;
  /** 0-1. */
  opacity: number;
}

/** Styling for the photo body itself, edited like the header/footer. */
export interface PhotoBody {
  enabled: boolean;
  /** Corner radius as a percentage (0-50) of the photo's shorter side. */
  radius: number;
  borderWidth: number;
  borderColor: string;
  /** 0-1. */
  opacity: number;
}

/** Non-destructive crop: a sub-rectangle of the current (already rotated/flipped) photo view, 0-1 relative. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rotation = 0 | 90 | 180 | 270;

/** The text sections that can be wrapped around the photo, in layout order. */
export type SectionKey =
  "header" | "subheader" | "left" | "right" | "caption" | "footer";

/** What's selected in the editor's left tree / canvas — drives which panel shows on the right. */
export type ImageSelection =
  | { type: "photo" }
  | { type: "section"; key: SectionKey }
  | { type: "layer"; id: string };

/**
 * Everything the image editor's undo/redo history tracks as one snapshot.
 * Transient interaction state (which layer is selected, an in-progress
 * drag/stroke/crop selection, the current tool) lives outside this, in
 * plain component state, so a drag gesture doesn't flood the history.
 */
export interface ImageDoc {
  layers: EditorLayer[];
  sections: Record<SectionKey, EditorBand>;
  photo: PhotoBody;
  background: string;
  adjustments: Adjustments;
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  crop: CropRect | null;
  strokes: DrawStroke[];
}
