import type { ColorName } from "@/types/media";

/** Swatch shown in the color filter UI for each bucket. */
export const COLOR_SWATCHES: Record<ColorName, string> = {
  red: "#dc2626",
  orange: "#ea580c",
  yellow: "#eab308",
  green: "#16a34a",
  teal: "#0d9488",
  blue: "#2563eb",
  purple: "#9333ea",
  pink: "#db2777",
  brown: "#92400e",
  white: "#f1f5f9",
  gray: "#64748b",
  black: "#171717",
};

export const COLOR_ORDER: ColorName[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "brown",
  "white",
  "gray",
  "black",
];

/** Classifies an average RGB sample into one of the named buckets above. */
export function classifyColor(r: number, g: number, b: number): ColorName {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;
  const delta = max - min;
  const saturation =
    delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255));

  if (lightness > 0.92) return "white";
  if (lightness < 0.1) return "black";
  if (saturation < 0.12) return "gray";

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  // Low-lightness, low/mid-saturation warm hues read as brown rather than orange.
  if (hue >= 15 && hue < 50 && lightness < 0.45 && saturation < 0.75)
    return "brown";

  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 160) return "green";
  if (hue < 195) return "teal";
  if (hue < 255) return "blue";
  if (hue < 300) return "purple";
  return "pink";
}

const cache = new Map<string, ColorName | null>();
const inFlight = new Map<string, Promise<ColorName | null>>();

function averageFromCanvas(
  source: CanvasImageSource,
  w: number,
  h: number,
): ColorName | null {
  const canvas = document.createElement("canvas");
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, w, h, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 16) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (count === 0) return null;
    return classifyColor(r / count, g / count, b / count);
  } catch {
    // Likely a cross-origin canvas tainting issue; fail soft.
    return null;
  }
}

function extractFromImage(src: string): Promise<ColorName | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve(averageFromCanvas(img, img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function extractFromVideo(src: string): Promise<ColorName | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "metadata";
    video.src = src;

    const settle = (value: ColorName | null) => {
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const timeout = window.setTimeout(() => settle(null), 8000);

    video.addEventListener(
      "loadeddata",
      () => {
        // Seek a hair in so we don't sample a black first frame.
        try {
          video.currentTime = Math.min(0.2, (video.duration || 1) / 2);
        } catch {
          window.clearTimeout(timeout);
          settle(averageFromCanvas(video, video.videoWidth, video.videoHeight));
        }
      },
      { once: true },
    );

    video.addEventListener(
      "seeked",
      () => {
        window.clearTimeout(timeout);
        settle(averageFromCanvas(video, video.videoWidth, video.videoHeight));
      },
      { once: true },
    );

    video.addEventListener("error", () => {
      window.clearTimeout(timeout);
      settle(null);
    });
  });
}

/** Extracts (and caches) the dominant color bucket for an image or video URL. */
export function getMediaColor(
  src: string,
  type: "image" | "video",
): Promise<ColorName | null> {
  if (cache.has(src)) return Promise.resolve(cache.get(src) ?? null);
  const existing = inFlight.get(src);
  if (existing) return existing;

  const task = (
    type === "image" ? extractFromImage(src) : extractFromVideo(src)
  ).then((color) => {
    cache.set(src, color);
    inFlight.delete(src);
    return color;
  });
  inFlight.set(src, task);
  return task;
}
