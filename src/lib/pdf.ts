import type * as PdfJsLib from "pdfjs-dist";
import type { PdfHighlight } from "@/types/pdf";

let modulePromise: Promise<typeof PdfJsLib> | null = null;

/**
 * Loads pdfjs-dist on demand — a multi-megabyte dependency most visits never
 * touch, same "lazy, out of the initial bundle" treatment lib/zip.ts gives
 * JSZip. Also points its worker at the bundled worker file, once.
 */
export function loadPdfjs(): Promise<typeof PdfJsLib> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjsLib;
    })();
  }
  return modulePromise;
}

function hexToUnitRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  const clean = match ? match[1] : "fef08a";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * Downloads `src` as a new PDF with every highlight baked in as a real,
 * translucent vector rectangle (multiply-blended, same look as the on-screen
 * overlay) — not a rasterized page image, so the original text stays crisp
 * and selectable. Highlight rects are 0-1 fractions of the page (see
 * types/pdf.ts), so they map straight onto pdf-lib's point-space page size
 * regardless of what zoom they were drawn at; pdf-lib's origin is
 * bottom-left, so the stored top-left-origin y has to flip.
 */
export async function downloadHighlightedPdf(
  src: string,
  filename: string,
  highlights: PdfHighlight[],
): Promise<void> {
  const { PDFDocument, rgb, BlendMode } = await import("pdf-lib");
  const res = await fetch(src);
  const bytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const pages = pdfDoc.getPages();

  for (const h of highlights) {
    const page = pages[h.page - 1];
    if (!page) continue;
    const { width, height } = page.getSize();
    const [r, g, b] = hexToUnitRgb(h.color);
    for (const rect of h.rects) {
      page.drawRectangle({
        x: rect.x * width,
        y: height - (rect.y + rect.h) * height,
        width: rect.w * width,
        height: rect.h * height,
        color: rgb(r, g, b),
        opacity: 0.45,
        blendMode: BlendMode.Multiply,
      });
    }
  }

  const outBytes = await pdfDoc.save();
  const blob = new Blob([outBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
