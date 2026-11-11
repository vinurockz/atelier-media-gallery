import type { EditorBand, SectionKey } from "@/types/editor";

export interface SectionDef {
  key: SectionKey;
  label: string;
  /** Side sections run along the photo's left/right edge, so their text is rotated. */
  orientation: "horizontal" | "vertical";
  band: EditorBand;
}

const BASE_BAND: EditorBand = {
  enabled: false,
  text: "",
  size: 72,
  background: "#111827",
  color: "#ffffff",
  fontSize: 32,
  fontFamily: "sans-serif",
  bold: true,
  italic: false,
  uppercase: false,
  align: "center",
  borderWidth: 0,
  borderColor: "#ffffff",
  opacity: 1,
};

/** In left-tree order; also the order they stack around the photo. */
export const SECTION_DEFS: SectionDef[] = [
  {
    key: "header",
    label: "Header",
    orientation: "horizontal",
    band: { ...BASE_BAND, text: "TOP HEADER" },
  },
  {
    key: "subheader",
    label: "Sub-header",
    orientation: "horizontal",
    band: {
      ...BASE_BAND,
      text: "Subtitle goes here",
      size: 48,
      fontSize: 22,
      bold: false,
      background: "#1f2937",
    },
  },
  {
    key: "left",
    label: "Left side",
    orientation: "vertical",
    band: {
      ...BASE_BAND,
      text: "LEFT",
      size: 56,
      fontSize: 24,
      background: "#374151",
    },
  },
  {
    key: "right",
    label: "Right side",
    orientation: "vertical",
    band: {
      ...BASE_BAND,
      text: "RIGHT",
      size: 56,
      fontSize: 24,
      background: "#374151",
    },
  },
  {
    key: "caption",
    label: "Caption",
    orientation: "horizontal",
    band: {
      ...BASE_BAND,
      text: "Write a caption...",
      size: 56,
      fontSize: 22,
      bold: false,
      italic: true,
      align: "left",
      background: "#f9fafb",
      color: "#111827",
      borderWidth: 1,
      borderColor: "#d1d5db",
    },
  },
  {
    key: "footer",
    label: "Footer",
    orientation: "horizontal",
    band: { ...BASE_BAND, text: "BOTTOM FOOTER" },
  },
];

export const SECTION_BY_KEY = Object.fromEntries(
  SECTION_DEFS.map((d) => [d.key, d]),
) as Record<SectionKey, SectionDef>;

export const DEFAULT_SECTIONS = Object.fromEntries(
  SECTION_DEFS.map((d) => [d.key, d.band]),
) as Record<SectionKey, EditorBand>;

/** Thickness a section adds to the canvas along its axis (0 when disabled). */
export function sectionThickness(band: EditorBand): number {
  return band.enabled ? band.size : 0;
}

/**
 * Draws a section into the rect (x, y, w, h). `quarterTurns` rotates the text
 * about the rect's center (-1 = read bottom-to-top, 1 = top-to-bottom) so side
 * sections can carry text along their long edge.
 */
export function drawSection(
  ctx: CanvasRenderingContext2D,
  band: EditorBand,
  x: number,
  y: number,
  w: number,
  h: number,
  quarterTurns: -1 | 0 | 1,
): void {
  if (!band.enabled || w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha = band.opacity;
  ctx.fillStyle = band.background;
  ctx.fillRect(x, y, w, h);
  if (band.borderWidth > 0) {
    const bw = band.borderWidth;
    ctx.strokeStyle = band.borderColor;
    ctx.lineWidth = bw;
    ctx.strokeRect(x + bw / 2, y + bw / 2, w - bw, h - bw);
  }

  if (band.text) {
    const textW = quarterTurns === 0 ? w : h;
    const inset = band.borderWidth + 16;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((quarterTurns * Math.PI) / 2);
    ctx.font = `${band.italic ? "italic " : ""}${band.bold ? "bold " : ""}${band.fontSize}px ${band.fontFamily}`;
    ctx.fillStyle = band.color;
    ctx.textAlign = band.align;
    ctx.textBaseline = "middle";
    const textX =
      band.align === "left"
        ? -textW / 2 + inset
        : band.align === "right"
          ? textW / 2 - inset
          : 0;
    const maxTextWidth =
      band.align === "center" ? textW * 0.94 : textW - inset * 2;
    ctx.fillText(
      band.uppercase ? band.text.toUpperCase() : band.text,
      textX,
      0,
      maxTextWidth,
    );
  }
  ctx.restore();
}
