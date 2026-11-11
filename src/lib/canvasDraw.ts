/** Whole-canvas editor effects — adjustments and freehand drawing — shared by the photo and video editors. */
export interface Adjustments {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  hue: number; // -180..180 degrees
  grayscale: number; // 0..100
  sepia: number; // 0..100
  invert: number; // 0..100
  blur: number; // 0..20 px
  /** 0 = off; otherwise the pixel block size — Photoshop-style "Mosaic"/pixelate. */
  pixelate: number;
  /** 0..100 — darkens the corners with a radial gradient, like Lightroom/Instagram's vignette. */
  vignette: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  blur: 0,
  pixelate: 0,
  vignette: 0,
};

export function isDefaultAdjustments(a: Adjustments): boolean {
  return Object.entries(DEFAULT_ADJUSTMENTS).every(
    ([key, value]) => a[key as keyof Adjustments] === value,
  );
}

function buildFilterCss(a: Adjustments): string {
  const parts: string[] = [];
  if (a.brightness !== 0)
    parts.push(`brightness(${(1 + a.brightness / 100).toFixed(2)})`);
  if (a.contrast !== 0)
    parts.push(`contrast(${(1 + a.contrast / 100).toFixed(2)})`);
  if (a.saturation !== 0)
    parts.push(`saturate(${Math.max(0, 1 + a.saturation / 100).toFixed(2)})`);
  if (a.hue !== 0) parts.push(`hue-rotate(${a.hue}deg)`);
  if (a.grayscale > 0) parts.push(`grayscale(${a.grayscale}%)`);
  if (a.sepia > 0) parts.push(`sepia(${a.sepia}%)`);
  if (a.invert > 0) parts.push(`invert(${a.invert}%)`);
  if (a.blur > 0) parts.push(`blur(${a.blur}px)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

/** Darkens the corners of (x, y, w, h) with a radial gradient — cheap enough (one gradient
 * fill) to run every frame, so it's safe in both the photo editor's static canvas and the
 * video editor's 30fps preview/export. */
function applyVignette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  amount: number,
): void {
  if (amount <= 0) return;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerR = Math.sqrt(w * w + h * h) / 2;
  const innerR = outerR * (1 - amount / 140);
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    Math.max(0, innerR),
    cx,
    cy,
    outerR,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.85, amount / 100)})`);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Draws `source` into (x, y, w, h) with the given adjustments applied. Pixelate isn't a CSS filter, so it's done manually. */
export function drawAdjusted(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  adjustments: Adjustments,
): void {
  const cssFilter = buildFilterCss(adjustments);

  if (adjustments.pixelate > 0) {
    const blockSize = Math.max(2, Math.round(adjustments.pixelate));
    const smallW = Math.max(1, Math.round(w / blockSize));
    const smallH = Math.max(1, Math.round(h / blockSize));
    const off = document.createElement("canvas");
    off.width = smallW;
    off.height = smallH;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    offCtx.filter = cssFilter;
    offCtx.drawImage(source, 0, 0, smallW, smallH);
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, smallW, smallH, x, y, w, h);
    ctx.imageSmoothingEnabled = prevSmoothing;
    applyVignette(ctx, x, y, w, h, adjustments.vignette);
    return;
  }

  const prevFilter = ctx.filter;
  ctx.filter = cssFilter;
  ctx.drawImage(source, x, y, w, h);
  ctx.filter = prevFilter;
  applyVignette(ctx, x, y, w, h, adjustments.vignette);
}

/** Simple 3x3 unsharp-style convolution — Photoshop's "Sharpen", applied once (not a live filter; too costly to re-run on every redraw). */
export function sharpenImageData(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const src = new Uint8ClampedArray(data);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += src[idx] * kernel[k];
            k++;
          }
        }
        data[(y * width + x) * 4 + c] = sum;
      }
    }
  }
  return imageData;
}

export interface FloodFillResult {
  mask: Uint8Array;
  bounds: { x: number; y: number; w: number; h: number };
}

/**
 * Classic "magic wand" selection: flood-fills out from (seedX, seedY) across
 * contiguous pixels within `tolerance` (0-100, mapped to an RGB distance
 * threshold) of the seed color. Powers the image editor's lasso tool's
 * one-click auto-select. Returns null if the seed point is out of bounds.
 */
export function floodFillSelect(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number,
): FloodFillResult | null {
  const { width, height, data } = imageData;
  if (seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) return null;

  const seedIdx = (seedY * width + seedX) * 4;
  const sr = data[seedIdx];
  const sg = data[seedIdx + 1];
  const sb = data[seedIdx + 2];
  const threshold = (Math.max(0, Math.min(100, tolerance)) / 100) * 300;

  const mask = new Uint8Array(width * height);
  const stack: number[] = [seedY * width + seedX];
  let minX = seedX;
  let maxX = seedX;
  let minY = seedY;
  let maxY = seedY;

  while (stack.length > 0) {
    const p = stack.pop() as number;
    if (mask[p]) continue;
    const x = p % width;
    const y = (p / width) | 0;
    const i = p * 4;
    const dr = data[i] - sr;
    const dg = data[i + 1] - sg;
    const db = data[i + 2] - sb;
    if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) continue;

    mask[p] = 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }

  return {
    mask,
    bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  points: StrokePoint[];
  color: string;
  size: number;
}

/** Renders one freehand doodle stroke (the photo editor's draw tool). */
export function drawFreehandStroke(
  ctx: CanvasRenderingContext2D,
  stroke: DrawStroke,
): void {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  const [first, ...rest] = stroke.points;
  ctx.moveTo(first.x, first.y);
  if (rest.length === 0) {
    ctx.lineTo(first.x + 0.01, first.y + 0.01);
  } else {
    rest.forEach((p) => ctx.lineTo(p.x, p.y));
  }
  ctx.stroke();
  ctx.restore();
}
