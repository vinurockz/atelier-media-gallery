import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MediaItem } from "@/types/media";
import type {
  CropRect,
  EditorBand,
  EditorLayer,
  ImageDoc,
  ImageSelection,
  LayerBlendMode,
  LayerShadow,
  Rotation,
  SectionKey,
} from "@/types/editor";
import {
  DEFAULT_SECTIONS,
  SECTION_BY_KEY,
  drawSection,
  sectionThickness,
} from "@/lib/sections";
import {
  drawImageLayer,
  drawMemeText,
  drawShape,
  drawSpeechBubble,
  drawSticker,
  type TextBounds,
} from "@/lib/memeText";
import {
  DEFAULT_ADJUSTMENTS,
  drawAdjusted,
  drawFreehandStroke,
  floodFillSelect,
  sharpenImageData,
  type Adjustments,
  type DrawStroke,
  type StrokePoint,
} from "@/lib/canvasDraw";
import { useHistory } from "@/hooks/useHistory";
import { AdjustmentsPanel } from "@/components/AdjustmentsPanel";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { BandPropertiesPanel } from "@/components/BandPropertiesPanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EditorTopBar } from "@/components/EditorTopBar";
import { ImageLayersPanel } from "@/components/ImageLayersPanel";
import { SliderRow } from "@/components/SliderRow";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  CopyIcon,
  CropIcon,
  EyedropperIcon,
  ImageIcon,
  LassoIcon,
  PencilIcon,
  RotateIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";

interface ImageEditorProps {
  item: MediaItem;
  /** The full library — lets "Select from library" insert an existing photo as a layer. */
  mediaItems: MediaItem[];
  onSave: (file: File) => Promise<void>;
  /**
   * Saves a lasso selection straight to the file manager as its own new
   * image, independent of the main per-document Save — the editor stays
   * open and the current document (layers, crop, etc.) is untouched.
   * Omitted entirely in contexts that can't import a standalone file.
   */
  onSaveSelection?: (file: File) => Promise<MediaItem | null>;
  onCancel: () => void;
}

const PADDING = 24;
const INITIAL_DOC: ImageDoc = {
  layers: [],
  sections: DEFAULT_SECTIONS,
  photo: {
    enabled: true,
    radius: 0,
    borderWidth: 0,
    borderColor: "#ffffff",
    opacity: 1,
  },
  background: "#f3f4f6",
  adjustments: DEFAULT_ADJUSTMENTS,
  rotation: 0,
  flipH: false,
  flipV: false,
  crop: null,
  strokes: [],
};
const STICKER_EMOJIS = [
  "😂",
  "🤣",
  "😎",
  "🤡",
  "👽",
  "💀",
  "🔥",
  "✨",
  "💯",
  "😱",
  "🥳",
  "👻",
  "🙄",
  "😏",
  "💩",
];

const BLEND_MODE_OPTIONS: { value: LayerBlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color dodge" },
  { value: "difference", label: "Difference" },
  { value: "hard-light", label: "Hard light" },
];

const DEFAULT_SHADOW: LayerShadow = {
  enabled: true,
  color: "#000000",
  blur: 12,
  offsetX: 4,
  offsetY: 4,
};

type ToolMode = "select" | "draw" | "crop" | "eyedropper" | "lasso";

interface ImageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type LassoSubTool = "wand" | "freehand";
type HandleCorner = "nw" | "ne" | "sw" | "se";

interface WandMask {
  mask: Uint8Array;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Canvas-based photo editor, laid out like a theme/page builder: a left
 * tree (Photo, Header, layers, Footer), a center canvas, and a
 * context-sensitive right properties panel for whatever's selected.
 * Meme text, speech bubbles, emoji stickers, shapes, freehand drawing,
 * Photoshop-style adjustments, a non-destructive crop, rotate/flip,
 * sharpen, an eyedropper, per-layer opacity, zoom, and full undo/redo.
 * Saved as a brand-new image in the file manager — the source photo is
 * never modified.
 */
export function ImageEditor({
  item,
  mediaItems,
  onSave,
  onSaveSelection,
  onCancel,
}: ImageEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const history = useHistory<ImageDoc>(INITIAL_DOC);
  const doc = history.state;

  const [selection, setSelection] = useState<ImageSelection>({ type: "photo" });
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(6);
  const [activeStroke, setActiveStroke] = useState<DrawStroke | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [cropDraft, setCropDraft] = useState<PixelRect | null>(null);
  const [lassoSubTool, setLassoSubTool] = useState<LassoSubTool>("wand");
  const [lassoTolerance, setLassoTolerance] = useState(30);
  // Freehand trace, in canvas-pixel space: in progress while dragging, kept
  // (not committed) once selectionRect is set, purely to clip the cutout to
  // the traced outline rather than its whole bounding box.
  const [lassoPoints, setLassoPoints] = useState<StrokePoint[] | null>(null);
  // Magic-wand flood-fill result for the last click, kept (not committed)
  // alongside selectionRect for the same reason.
  const [wandMask, setWandMask] = useState<WandMask | null>(null);
  // The current pending selection's bounding box — draggable by its corner
  // handles so "modify sides" trims the selection before it's used, without
  // touching the underlying trace/mask.
  const [selectionRect, setSelectionRect] = useState<PixelRect | null>(null);
  const [savingSelection, setSavingSelection] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [pickedMessage, setPickedMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [sharpening, setSharpening] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  // Bumped after every draw pass so the floating toolbar (computed from
  // boundsRef, a ref, during render) re-reads fresh bounds right after a
  // layer is added/selected — otherwise it reads last pass's bounds, since
  // writing a ref doesn't itself trigger a re-render.
  const [boundsVersion, setBoundsVersion] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Draws the lasso selection preview on its own canvas, kept pixel-aligned
  // with canvasRef but never baked into it — so buildSelectionCutout never
  // picks up the preview (mask highlight, trace, handles) itself.
  const lassoCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Loaded elements for imported image layers, keyed by data URL. An entry is
  // always added before the layer that uses it, so the draw pass can rely on it.
  const layerImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const boundsRef = useRef<Record<string, TextBounds>>({});
  const regionRef = useRef<ImageRegion>({ x: PADDING, y: PADDING, w: 0, h: 0 });
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  // The point the active wand selection was seeded from, so the Tolerance
  // slider can re-run the flood fill from the same spot as it's adjusted.
  const wandSeedRef = useRef<StrokePoint | null>(null);
  const handleDragRef = useRef<HandleCorner | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.src = item.src;
    return () => {
      cancelled = true;
    };
  }, [item.src]);

  // --- Undo/redo keyboard shortcuts --------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if (
        e.key.toLowerCase() === "y" ||
        (e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        history.redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // Depend on the stable undo/redo callbacks, not `history` itself — useHistory
    // returns a new object every render, which would re-attach this listener constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.undo, history.redo]);

  const selectedLayer =
    selection.type === "layer"
      ? (doc.layers.find((l) => l.id === selection.id) ?? null)
      : null;

  const updateLayer = (id: string, patch: Partial<EditorLayer>) => {
    history.set((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  };

  const updateSection = (key: SectionKey, patch: Partial<EditorBand>) => {
    history.set((d) => ({
      ...d,
      sections: { ...d.sections, [key]: { ...d.sections[key], ...patch } },
    }));
  };

  const deleteLayer = (id: string) => {
    history.set((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelection((prev) =>
      prev.type === "layer" && prev.id === id ? { type: "photo" } : prev,
    );
  };

  const duplicateLayer = (id: string) => {
    const newId = `layer:${crypto.randomUUID()}`;
    history.set((d) => {
      const original = d.layers.find((l) => l.id === id);
      if (!original) return d;
      const copy: EditorLayer = {
        ...original,
        id: newId,
        x: Math.min(1, original.x + 0.05),
        y: Math.min(1, original.y + 0.05),
      };
      return { ...d, layers: [...d.layers, copy] };
    });
    setSelection({ type: "layer", id: newId });
  };

  const addLayer = (
    kind: EditorLayer["kind"],
    y: number,
    presetText?: string,
  ) => {
    if (!image) return;
    const id = `layer:${crypto.randomUUID()}`;
    const baseWidth = regionRef.current.w || image.naturalWidth;
    const sizeRatio =
      kind === "sticker"
        ? 0.12
        : kind === "bubble"
          ? 0.04
          : kind === "text"
            ? 0.08
            : 0.16;
    const fontSize = Math.round(baseWidth * sizeRatio);
    let layer: EditorLayer;
    if (kind === "text") {
      layer = {
        id,
        kind,
        text: presetText ?? "YOUR TEXT",
        x: 0.5,
        y,
        fontSize,
        color: "#ffffff",
        strokeColor: "#000000",
        opacity: 1,
      };
    } else if (kind === "bubble") {
      layer = {
        id,
        kind,
        text: presetText ?? "Say something...",
        x: 0.5,
        y,
        fontSize,
        color: "#111827",
        strokeColor: "#ffffff",
        opacity: 1,
      };
    } else if (kind === "sticker") {
      layer = {
        id,
        kind,
        text: presetText ?? "😀",
        x: 0.5,
        y,
        fontSize,
        color: "#000000",
        strokeColor: "#000000",
        opacity: 1,
      };
    } else {
      layer = {
        id,
        kind,
        text: "",
        x: 0.5,
        y,
        fontSize,
        color: activeColor,
        strokeColor: "#1f2937",
        opacity: 1,
      };
    }
    history.set((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelection({ type: "layer", id });
    setToolMode("select");
  };

  const addImages = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const baseWidth = regionRef.current.w || image?.naturalWidth || 800;
    const added: EditorLayer[] = [];
    for (const [i, file] of imageFiles.entries()) {
      try {
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const el = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
          img.src = src;
        });
        layerImagesRef.current.set(src, el);
        added.push({
          id: `layer:${crypto.randomUUID()}`,
          kind: "image",
          text: "",
          src,
          aspect: el.naturalHeight / el.naturalWidth,
          x: Math.min(0.9, 0.5 + i * 0.08),
          y: Math.min(0.9, 0.5 + i * 0.08),
          fontSize: Math.round(baseWidth * 0.35),
          color: "#000000",
          strokeColor: "#000000",
          opacity: 1,
        });
      } catch (err) {
        console.error("Image import failed", err);
      }
    }
    finalizeAddedImageLayers(added);
  };

  const finalizeAddedImageLayers = (added: EditorLayer[]) => {
    if (added.length === 0) return;
    history.set((d) => ({ ...d, layers: [...d.layers, ...added] }));
    setSelection({ type: "layer", id: added[added.length - 1].id });
    setToolMode("select");
  };

  /** "Select from library" — inserts an already-imported photo as a layer, instead of uploading a fresh copy. */
  const addExistingImages = async (items: MediaItem[]) => {
    const imageItems = items.filter((i) => i.type === "image");
    if (imageItems.length === 0) return;
    const baseWidth = regionRef.current.w || image?.naturalWidth || 800;
    const added: EditorLayer[] = [];
    for (const [i, mediaItem] of imageItems.entries()) {
      try {
        const el = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () =>
            reject(new Error(`Couldn't load ${mediaItem.title}`));
          img.src = mediaItem.src;
        });
        layerImagesRef.current.set(mediaItem.src, el);
        added.push({
          id: `layer:${crypto.randomUUID()}`,
          kind: "image",
          text: "",
          src: mediaItem.src,
          aspect: el.naturalHeight / el.naturalWidth,
          x: Math.min(0.9, 0.5 + i * 0.08),
          y: Math.min(0.9, 0.5 + i * 0.08),
          fontSize: Math.round(baseWidth * 0.35),
          color: "#000000",
          strokeColor: "#000000",
          opacity: 1,
        });
      } catch (err) {
        console.error("Image import failed", err);
      }
    }
    finalizeAddedImageLayers(added);
  };

  // --- Draw ----------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const {
      sections,
      photo,
      background,
      adjustments,
      rotation,
      flipH,
      flipV,
      crop,
      strokes,
      layers,
    } = doc;
    const headerH = sectionThickness(sections.header);
    const subheaderH = sectionThickness(sections.subheader);
    const captionH = sectionThickness(sections.caption);
    const footerH = sectionThickness(sections.footer);
    const leftW = sectionThickness(sections.left);
    const rightW = sectionThickness(sections.right);
    const rotated = rotation === 90 || rotation === 270;
    const fullW = rotated ? image.naturalHeight : image.naturalWidth;
    const fullH = rotated ? image.naturalWidth : image.naturalHeight;

    const photoCanvas = document.createElement("canvas");
    photoCanvas.width = fullW;
    photoCanvas.height = fullH;
    const pctx = photoCanvas.getContext("2d");
    if (!pctx) return;
    pctx.save();
    pctx.translate(fullW / 2, fullH / 2);
    pctx.rotate((rotation * Math.PI) / 180);
    pctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    drawAdjusted(
      pctx,
      image,
      -image.naturalWidth / 2,
      -image.naturalHeight / 2,
      image.naturalWidth,
      image.naturalHeight,
      adjustments,
    );
    pctx.restore();

    const cropRect = crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const srcX = cropRect.x * fullW;
    const srcY = cropRect.y * fullH;
    const srcW = Math.max(1, cropRect.w * fullW);
    const srcH = Math.max(1, cropRect.h * fullH);

    const totalW = leftW + srcW + rightW;
    canvas.width = totalW + PADDING * 2;
    canvas.height =
      headerH + subheaderH + srcH + captionH + footerH + PADDING * 2;
    if (lassoCanvasRef.current) {
      lassoCanvasRef.current.width = canvas.width;
      lassoCanvasRef.current.height = canvas.height;
    }

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const region: ImageRegion = {
      x: PADDING + leftW,
      y: PADDING + headerH + subheaderH,
      w: srcW,
      h: srcH,
    };
    regionRef.current = region;

    // Stacked top-to-bottom; side sections flank the photo row.
    drawSection(ctx, sections.header, PADDING, PADDING, totalW, headerH, 0);
    drawSection(
      ctx,
      sections.subheader,
      PADDING,
      PADDING + headerH,
      totalW,
      subheaderH,
      0,
    );
    drawSection(ctx, sections.left, PADDING, region.y, leftW, srcH, -1);
    drawSection(
      ctx,
      sections.right,
      region.x + srcW,
      region.y,
      rightW,
      srcH,
      1,
    );
    drawSection(
      ctx,
      sections.caption,
      PADDING,
      region.y + srcH,
      totalW,
      captionH,
      0,
    );
    drawSection(
      ctx,
      sections.footer,
      PADDING,
      region.y + srcH + captionH,
      totalW,
      footerH,
      0,
    );

    if (photo.enabled) {
      const radius = (Math.min(region.w, region.h) * photo.radius) / 100;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(region.x, region.y, region.w, region.h, radius);
      ctx.clip();
      ctx.globalAlpha = photo.opacity;
      ctx.drawImage(
        photoCanvas,
        srcX,
        srcY,
        srcW,
        srcH,
        region.x,
        region.y,
        region.w,
        region.h,
      );
      ctx.restore();
      if (photo.borderWidth > 0) {
        const half = photo.borderWidth / 2;
        ctx.save();
        ctx.strokeStyle = photo.borderColor;
        ctx.lineWidth = photo.borderWidth;
        ctx.beginPath();
        ctx.roundRect(
          region.x + half,
          region.y + half,
          region.w - photo.borderWidth,
          region.h - photo.borderWidth,
          Math.max(0, radius - half),
        );
        ctx.stroke();
        ctx.restore();
      }
    }

    [...strokes, activeStroke].forEach((stroke) => {
      if (stroke) drawFreehandStroke(ctx, stroke);
    });

    const bounds: Record<string, TextBounds> = {};
    const displayLayers = layers.map((l) =>
      dragPreview && l.id === dragPreview.id
        ? { ...l, x: dragPreview.x, y: dragPreview.y }
        : l,
    );
    displayLayers.forEach((layer) => {
      const cx = region.x + layer.x * region.w;
      const cy = region.y + layer.y * region.h;
      const maxWidth =
        layer.kind === "bubble" ? region.w * 0.6 : region.w * 0.9;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      // Canvas calls the default blend "source-over", not "normal" — the type dropdown keeps
      // the familiar Photoshop/Photopea name, translated here.
      ctx.globalCompositeOperation =
        layer.blendMode && layer.blendMode !== "normal"
          ? layer.blendMode
          : "source-over";
      if (layer.shadow?.enabled) {
        ctx.shadowColor = layer.shadow.color;
        ctx.shadowBlur = layer.shadow.blur;
        ctx.shadowOffsetX = layer.shadow.offsetX;
        ctx.shadowOffsetY = layer.shadow.offsetY;
      }
      if (layer.kind === "bubble") {
        bounds[layer.id] = drawSpeechBubble(
          ctx,
          layer.text,
          cx,
          cy,
          layer.fontSize,
          layer.color,
          layer.strokeColor,
          maxWidth,
        );
      } else if (layer.kind === "sticker") {
        bounds[layer.id] = drawSticker(ctx, layer.text, cx, cy, layer.fontSize);
      } else if (layer.kind === "image") {
        const el = layer.src
          ? layerImagesRef.current.get(layer.src)
          : undefined;
        bounds[layer.id] = el
          ? drawImageLayer(ctx, el, cx, cy, layer.fontSize, layer.aspect ?? 1)
          : { x: cx, y: cy, width: 0, height: 0 };
      } else if (
        layer.kind === "rect" ||
        layer.kind === "ellipse" ||
        layer.kind === "line"
      ) {
        bounds[layer.id] = drawShape(
          ctx,
          layer.kind,
          cx,
          cy,
          layer.fontSize,
          layer.color,
          layer.strokeColor,
        );
      } else {
        bounds[layer.id] = drawMemeText(
          ctx,
          layer.text,
          cx,
          cy,
          layer.fontSize,
          layer.color,
          layer.strokeColor,
          maxWidth,
        );
      }
      ctx.restore();
    });
    boundsRef.current = bounds;
    setBoundsVersion((v) => v + 1);

    if (cropDraft && cropDraft.w > 2 && cropDraft.h > 2) {
      ctx.save();
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(cropDraft.x, cropDraft.y, cropDraft.w, cropDraft.h);
      ctx.strokeRect(cropDraft.x, cropDraft.y, cropDraft.w, cropDraft.h);
      ctx.restore();
    }
  }, [image, doc, dragPreview, activeStroke, cropDraft]);

  // Lasso selection preview (wand highlight, freehand trace, and the
  // adjustable bounding box + corner handles) lives on its own canvas (see
  // lassoCanvasRef) so none of it ever gets baked into the pixels
  // buildSelectionCutout captures.
  useEffect(() => {
    const canvas = lassoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (
      wandMask &&
      wandMask.canvasWidth === canvas.width &&
      wandMask.canvasHeight === canvas.height
    ) {
      const imgData = ctx.createImageData(canvas.width, canvas.height);
      for (let p = 0; p < wandMask.mask.length; p++) {
        if (!wandMask.mask[p]) continue;
        const i = p * 4;
        imgData.data[i] = 37;
        imgData.data[i + 1] = 99;
        imgData.data[i + 2] = 235;
        imgData.data[i + 3] = 110;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    if (lassoPoints && lassoPoints.length >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }

    if (selectionRect) {
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(
        selectionRect.x,
        selectionRect.y,
        selectionRect.w,
        selectionRect.h,
      );
      const corners: Array<[number, number]> = [
        [selectionRect.x, selectionRect.y],
        [selectionRect.x + selectionRect.w, selectionRect.y],
        [selectionRect.x, selectionRect.y + selectionRect.h],
        [selectionRect.x + selectionRect.w, selectionRect.y + selectionRect.h],
      ];
      corners.forEach(([hx, hy]) => {
        ctx.fillStyle = "#2563eb";
        ctx.fillRect(hx - 5, hy - 5, 10, 10);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hx - 5, hy - 5, 10, 10);
      });
      ctx.restore();
    }
  }, [lassoPoints, wandMask, selectionRect]);

  // --- Pointer (drag layers, freehand draw, crop selection, eyedropper, lasso) ---

  const toCanvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = toCanvasPoint(e);

    if (toolMode === "eyedropper") {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const [r, g, b] = ctx.getImageData(
        Math.round(p.x),
        Math.round(p.y),
        1,
        1,
      ).data;
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      setActiveColor(hex);
      setPickedMessage(`Picked ${hex} — now your draw/shape color`);
      setToolMode("select");
      return;
    }

    if (toolMode === "crop") {
      cropStartRef.current = p;
      setCropDraft({ x: p.x, y: p.y, w: 0, h: 0 });
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (toolMode === "lasso") {
      if (selectionRect) {
        const corner = hitTestHandle(p, selectionRect, handleHitRadius());
        if (corner) {
          handleDragRef.current = corner;
          canvasRef.current?.setPointerCapture(e.pointerId);
          return;
        }
      }
      // Starting a fresh pick/trace discards any pending selection.
      setSelectionRect(null);
      setWandMask(null);
      setLassoPoints(null);
      setSelectionMessage(null);
      if (lassoSubTool === "wand") {
        wandSeedRef.current = p;
        runWandSelect(p, lassoTolerance);
      } else {
        setLassoPoints([p]);
      }
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (toolMode === "draw") {
      setActiveStroke({ points: [p], color: activeColor, size: brushSize });
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    let hitId: string | null = null;
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const b = boundsRef.current[doc.layers[i].id];
      if (
        b &&
        p.x >= b.x &&
        p.x <= b.x + b.width &&
        p.y >= b.y &&
        p.y <= b.y + b.height
      ) {
        hitId = doc.layers[i].id;
        break;
      }
    }
    setSelection(hitId ? { type: "layer", id: hitId } : { type: "photo" });
    if (!hitId) return;
    const layer = doc.layers.find((l) => l.id === hitId);
    if (!layer) return;
    const region = regionRef.current;
    const cx = region.x + layer.x * region.w;
    const cy = region.y + layer.y * region.h;
    dragRef.current = { id: hitId, dx: p.x - cx, dy: p.y - cy };
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = toCanvasPoint(e);

    if (toolMode === "crop") {
      if (!cropStartRef.current) return;
      const start = cropStartRef.current;
      setCropDraft({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      });
      return;
    }

    if (toolMode === "lasso") {
      if (handleDragRef.current) {
        resizeSelectionRect(p, handleDragRef.current);
        return;
      }
      if (lassoSubTool === "freehand" && lassoPoints) {
        setLassoPoints((prev) => (prev ? [...prev, p] : prev));
      }
      return;
    }

    if (toolMode === "draw") {
      if (!activeStroke) return;
      setActiveStroke((prev) =>
        prev ? { ...prev, points: [...prev.points, p] } : prev,
      );
      return;
    }

    if (!dragRef.current) return;
    const { id, dx, dy } = dragRef.current;
    const region = regionRef.current;
    const relX = Math.min(1, Math.max(0, (p.x - dx - region.x) / region.w));
    const relY = Math.min(1, Math.max(0, (p.y - dy - region.y) / region.h));
    setDragPreview({ id, x: relX, y: relY });
  };

  const onPointerUp = () => {
    if (toolMode === "crop") {
      cropStartRef.current = null;
      return;
    }

    if (toolMode === "lasso") {
      if (handleDragRef.current) {
        handleDragRef.current = null;
        return;
      }
      if (
        lassoSubTool === "freehand" &&
        lassoPoints &&
        lassoPoints.length >= 3
      ) {
        const canvas = canvasRef.current;
        const xs = lassoPoints.map((pt) => pt.x);
        const ys = lassoPoints.map((pt) => pt.y);
        const minX = Math.max(0, Math.min(...xs));
        const minY = Math.max(0, Math.min(...ys));
        const maxX = Math.min(canvas?.width ?? minX, Math.max(...xs));
        const maxY = Math.min(canvas?.height ?? minY, Math.max(...ys));
        if (maxX - minX >= 6 && maxY - minY >= 6) {
          setSelectionRect({
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
          });
        } else {
          setLassoPoints(null);
        }
      }
      return;
    }

    if (toolMode === "draw") {
      setActiveStroke((prev) => {
        if (prev) history.set((d) => ({ ...d, strokes: [...d.strokes, prev] }));
        return null;
      });
      return;
    }

    if (dragRef.current && dragPreview) {
      const { id } = dragRef.current;
      const { x, y } = dragPreview;
      history.set((d) => ({
        ...d,
        layers: d.layers.map((l) => (l.id === id ? { ...l, x, y } : l)),
      }));
    }
    dragRef.current = null;
    setDragPreview(null);
  };

  // --- Crop, rotate, flip, sharpen ------------------------------------------

  const applyCrop = () => {
    if (!cropDraft || cropDraft.w < 6 || cropDraft.h < 6) {
      setCropDraft(null);
      return;
    }
    const region = regionRef.current;
    const relX = Math.max(0, Math.min(1, (cropDraft.x - region.x) / region.w));
    const relY = Math.max(0, Math.min(1, (cropDraft.y - region.y) / region.h));
    const relW = Math.max(0.02, Math.min(1 - relX, cropDraft.w / region.w));
    const relH = Math.max(0.02, Math.min(1 - relY, cropDraft.h / region.h));
    history.set((d) => {
      const base: CropRect = d.crop ?? { x: 0, y: 0, w: 1, h: 1 };
      return {
        ...d,
        crop: {
          x: base.x + relX * base.w,
          y: base.y + relY * base.h,
          w: relW * base.w,
          h: relH * base.h,
        },
      };
    });
    setCropDraft(null);
    setToolMode("select");
  };

  const resetCrop = () => {
    history.set((d) => ({ ...d, crop: null }));
    setCropDraft(null);
  };

  /** Flood-fills from canvas point `p` (the magic wand's one-click auto-select) and seeds the pending selection from the result. */
  const runWandSelect = (p: StrokePoint, tolerance: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = floodFillSelect(
      imageData,
      Math.round(p.x),
      Math.round(p.y),
      tolerance,
    );
    if (!result) return;
    setWandMask({
      mask: result.mask,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
    setSelectionRect(result.bounds);
  };

  const handleHitRadius = () => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect || rect.width === 0) return 10;
    return 10 * (canvas.width / rect.width);
  };

  const hitTestHandle = (
    p: StrokePoint,
    rect: PixelRect,
    radius: number,
  ): HandleCorner | null => {
    const corners: Array<[HandleCorner, number, number]> = [
      ["nw", rect.x, rect.y],
      ["ne", rect.x + rect.w, rect.y],
      ["sw", rect.x, rect.y + rect.h],
      ["se", rect.x + rect.w, rect.y + rect.h],
    ];
    for (const [corner, hx, hy] of corners) {
      if (Math.hypot(p.x - hx, p.y - hy) <= radius) return corner;
    }
    return null;
  };

  /** Drags one corner of the pending selection's bounding box — "modify sides" — keeping the opposite corner fixed. */
  const resizeSelectionRect = (p: StrokePoint, corner: HandleCorner) => {
    setSelectionRect((prev) => {
      if (!prev) return prev;
      const canvas = canvasRef.current;
      const maxW = canvas?.width ?? prev.x + prev.w;
      const maxH = canvas?.height ?? prev.y + prev.h;
      let left = prev.x;
      let top = prev.y;
      let right = prev.x + prev.w;
      let bottom = prev.y + prev.h;
      if (corner === "nw") {
        left = p.x;
        top = p.y;
      } else if (corner === "ne") {
        right = p.x;
        top = p.y;
      } else if (corner === "sw") {
        left = p.x;
        bottom = p.y;
      } else {
        right = p.x;
        bottom = p.y;
      }
      left = Math.max(0, Math.min(left, right - 10));
      top = Math.max(0, Math.min(top, bottom - 10));
      right = Math.min(maxW, Math.max(right, left + 10));
      bottom = Math.min(maxH, Math.max(bottom, top + 10));
      return { x: left, y: top, w: right - left, h: bottom - top };
    });
  };

  /**
   * Renders the pending selection (wand mask and/or freehand trace, trimmed
   * to selectionRect's current sides) out of the current composite — photo
   * plus everything already drawn, since that's what's visible to pick from
   * — onto a brand-new canvas. Used by both "Cut out as layer" and "Save as
   * new image"; neither touches the source photo.
   */
  const buildSelectionCutout = (): HTMLCanvasElement | null => {
    const canvas = canvasRef.current;
    if (!canvas || !selectionRect) return null;
    const rectX = Math.max(0, Math.round(selectionRect.x));
    const rectY = Math.max(0, Math.round(selectionRect.y));
    const w = Math.min(canvas.width - rectX, Math.round(selectionRect.w));
    const h = Math.min(canvas.height - rectY, Math.round(selectionRect.h));
    if (w < 6 || h < 6) return null;

    const cutout = document.createElement("canvas");
    cutout.width = w;
    cutout.height = h;
    const cctx = cutout.getContext("2d");
    if (!cctx) return null;

    if (lassoPoints && lassoPoints.length >= 3) {
      cctx.save();
      cctx.beginPath();
      cctx.moveTo(lassoPoints[0].x - rectX, lassoPoints[0].y - rectY);
      lassoPoints
        .slice(1)
        .forEach((pt) => cctx.lineTo(pt.x - rectX, pt.y - rectY));
      cctx.closePath();
      cctx.clip();
      cctx.drawImage(canvas, -rectX, -rectY);
      cctx.restore();
    } else {
      cctx.drawImage(canvas, -rectX, -rectY);
    }

    if (
      wandMask &&
      wandMask.canvasWidth === canvas.width &&
      wandMask.canvasHeight === canvas.height
    ) {
      const imgData = cctx.getImageData(0, 0, w, h);
      const { mask, canvasWidth, canvasHeight } = wandMask;
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const cx = rectX + xx;
          const cy = rectY + yy;
          const inMask =
            cx < canvasWidth &&
            cy < canvasHeight &&
            mask[cy * canvasWidth + cx] === 1;
          if (!inMask) imgData.data[(yy * w + xx) * 4 + 3] = 0;
        }
      }
      cctx.putImageData(imgData, 0, 0);
    }

    return cutout;
  };

  const clearSelectionState = () => {
    setLassoPoints(null);
    setWandMask(null);
    setSelectionRect(null);
    setSelectionMessage(null);
    wandSeedRef.current = null;
  };

  /** Adds the pending selection to the document as a new, independently draggable/resizable image layer. */
  const cutOutAsLayer = async () => {
    const cutout = buildSelectionCutout();
    if (!cutout || !selectionRect) return;
    const src = cutout.toDataURL("image/png");
    let el: HTMLImageElement;
    try {
      el = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error("Selection cutout failed to load"));
        img.src = src;
      });
    } catch (err) {
      console.error("Lasso cutout failed", err);
      return;
    }
    layerImagesRef.current.set(src, el);

    const region = regionRef.current;
    const id = `layer:${crypto.randomUUID()}`;
    const layer: EditorLayer = {
      id,
      kind: "image",
      text: "",
      src,
      aspect: selectionRect.h / selectionRect.w,
      x: Math.min(
        1,
        Math.max(
          0,
          (selectionRect.x + selectionRect.w / 2 - region.x) / region.w,
        ),
      ),
      y: Math.min(
        1,
        Math.max(
          0,
          (selectionRect.y + selectionRect.h / 2 - region.y) / region.h,
        ),
      ),
      fontSize: selectionRect.w,
      color: "#000000",
      strokeColor: "#000000",
      opacity: 1,
    };
    history.set((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelection({ type: "layer", id });
    setToolMode("select");
    clearSelectionState();
  };

  /** Saves the pending selection to the file manager as a brand-new image — the editor stays open and the current document is untouched. */
  const saveSelectionAsImage = async () => {
    if (!onSaveSelection) return;
    const cutout = buildSelectionCutout();
    if (!cutout) return;
    setSavingSelection(true);
    setSelectionMessage(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        cutout.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Selection export failed");
      const file = new File([blob], `${item.title}-selection.png`, {
        type: "image/png",
      });
      const result = await onSaveSelection(file);
      setSelectionMessage(
        result
          ? `Saved "${file.name}" to your file manager.`
          : "Couldn't save the selection.",
      );
    } catch (err) {
      console.error("Saving selection failed", err);
      setSelectionMessage("Couldn't save the selection.");
    } finally {
      setSavingSelection(false);
    }
  };

  const rotate = (direction: 1 | -1) => {
    history.set((d) => ({
      ...d,
      rotation: ((((d.rotation + direction * 90) % 360) + 360) %
        360) as Rotation,
    }));
  };

  const applySharpen = () => {
    if (!image) return;
    setSharpening(true);
    try {
      const { rotation, flipH, flipV, crop, adjustments } = doc;
      const rotated = rotation === 90 || rotation === 270;
      const fullW = rotated ? image.naturalHeight : image.naturalWidth;
      const fullH = rotated ? image.naturalWidth : image.naturalHeight;

      const full = document.createElement("canvas");
      full.width = fullW;
      full.height = fullH;
      const fctx = full.getContext("2d");
      if (!fctx) return;
      fctx.save();
      fctx.translate(fullW / 2, fullH / 2);
      fctx.rotate((rotation * Math.PI) / 180);
      fctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      drawAdjusted(
        fctx,
        image,
        -image.naturalWidth / 2,
        -image.naturalHeight / 2,
        image.naturalWidth,
        image.naturalHeight,
        adjustments,
      );
      fctx.restore();

      const cropRect = crop ?? { x: 0, y: 0, w: 1, h: 1 };
      const srcX = cropRect.x * fullW;
      const srcY = cropRect.y * fullH;
      const srcW = Math.max(1, Math.round(cropRect.w * fullW));
      const srcH = Math.max(1, Math.round(cropRect.h * fullH));

      const cropped = document.createElement("canvas");
      cropped.width = srcW;
      cropped.height = srcH;
      const cctx = cropped.getContext("2d");
      if (!cctx) return;
      cctx.drawImage(full, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      const imageData = cctx.getImageData(0, 0, srcW, srcH);
      sharpenImageData(imageData);
      cctx.putImageData(imageData, 0, 0);

      const newImg = new Image();
      newImg.onload = () => {
        setImage(newImg);
        history.set((d) => ({
          ...d,
          rotation: 0,
          flipH: false,
          flipV: false,
          crop: null,
          adjustments: DEFAULT_ADJUSTMENTS,
        }));
        setSharpening(false);
      };
      newImg.src = cropped.toDataURL("image/png");
    } catch (err) {
      console.error("Sharpen failed", err);
      setSharpening(false);
    }
  };

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Canvas export failed");
      const file = new File([blob], `${item.title}-edited.png`, {
        type: "image/png",
      });
      await onSave(file);
    } finally {
      setSaving(false);
    }
  }, [item.title, onSave]);

  const adjust = (patch: Partial<Adjustments>) =>
    history.set((d) => ({ ...d, adjustments: { ...d.adjustments, ...patch } }));

  // --- Floating duplicate/delete pill for the selected layer ---------------

  // Recomputed whenever boundsVersion changes (a fresh draw pass updated
  // boundsRef) or zoom changes (the canvas's on-screen size changed) — both
  // affect where this should be positioned, and neither is otherwise
  // reflected in a prop/state this render would naturally re-derive from.
  const floatingStyle = useMemo<CSSProperties | null>(() => {
    const canvasEl = canvasRef.current;
    if (!selectedLayer || !canvasEl) return null;
    const bounds = boundsRef.current[selectedLayer.id];
    const rect = canvasEl.getBoundingClientRect();
    if (!bounds || rect.width === 0) return null;
    const scale = rect.width / canvasEl.width;
    return {
      left: (bounds.x + bounds.width / 2) * scale,
      top: (bounds.y + bounds.height) * scale + 8,
      transform: "translateX(-50%)",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer, boundsVersion, zoom]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addImages(files);
        }}
      />
      {showLibraryPicker && (
        <AttachMediaModal
          items={mediaItems}
          typeFilter="image"
          multiple
          title="Select images to insert"
          onClose={() => setShowLibraryPicker(false)}
          onConfirm={(ids) => {
            void addExistingImages(
              mediaItems.filter((m) => ids.includes(m.id)),
            );
            setShowLibraryPicker(false);
          }}
        />
      )}
      <EditorTopBar
        title={item.title}
        onCancel={onCancel}
        onUndo={history.undo}
        onRedo={history.redo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        zoom={zoom}
        onZoomChange={setZoom}
        onSave={handleSave}
        saving={saving}
      >
        <button
          type="button"
          onClick={() => setToolMode("select")}
          className={modeBtnClass(toolMode === "select")}
        >
          Select
        </button>
        <button
          type="button"
          onClick={() => setToolMode("draw")}
          className={modeBtnClass(toolMode === "draw")}
        >
          <PencilIcon className="size-3.5" />
          Draw
        </button>
        <button
          type="button"
          onClick={() => setToolMode("crop")}
          className={modeBtnClass(toolMode === "crop")}
        >
          <CropIcon className="size-3.5" />
          Crop
        </button>
        <button
          type="button"
          onClick={() => setToolMode("lasso")}
          className={modeBtnClass(toolMode === "lasso")}
        >
          <LassoIcon className="size-3.5" />
          Lasso
        </button>
        <button
          type="button"
          onClick={() => setToolMode("eyedropper")}
          className={modeBtnClass(toolMode === "eyedropper")}
        >
          <EyedropperIcon className="size-3.5" />
          Pick
        </button>
      </EditorTopBar>

      <div className="flex min-h-0 flex-1">
        <ImageLayersPanel
          doc={doc}
          selection={selection}
          onSelect={setSelection}
          onAddLayer={addLayer}
          onAddImages={() => fileInputRef.current?.click()}
          onDeleteLayer={deleteLayer}
          onTogglePhoto={(enabled) =>
            history.set((d) => ({ ...d, photo: { ...d.photo, enabled } }))
          }
          onToggleSection={(key, enabled) => updateSection(key, { enabled })}
        />

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-neutral-100 p-8">
          {!image ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : (
            <div className="relative flex h-full w-full items-center justify-center">
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                className="touch-none rounded-lg bg-white shadow-sm ring-1 ring-black/5"
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: `min(100%, ${Math.round(720 * zoom)}px)`,
                  maxHeight: `${Math.round(100 * zoom)}%`,
                }}
              />
              <canvas
                ref={lassoCanvasRef}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none rounded-lg"
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: `min(100%, ${Math.round(720 * zoom)}px)`,
                  maxHeight: `${Math.round(100 * zoom)}%`,
                }}
              />
              {selectedLayer && floatingStyle && (
                <div
                  style={floatingStyle}
                  className="absolute flex items-center gap-0.5 rounded-md bg-neutral-900 p-1 shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => duplicateLayer(selectedLayer.id)}
                    title="Duplicate"
                    className="flex size-6 items-center justify-center rounded text-white transition hover:bg-white/15"
                  >
                    <CopyIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteLayer(selectedLayer.id)}
                    title="Delete"
                    className="flex size-6 items-center justify-center rounded text-white transition hover:bg-white/15"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {toolMode === "crop" && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={applyCrop}
                disabled={!cropDraft}
                className={primaryBtnClass}
              >
                Apply crop
              </button>
              <button
                type="button"
                onClick={() => setCropDraft(null)}
                className={toolBtnClass}
              >
                Cancel
              </button>
              {doc.crop && (
                <button
                  type="button"
                  onClick={resetCrop}
                  className={toolBtnClass}
                >
                  Reset crop
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white">
          {toolMode === "draw" ? (
            <div className="flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">Draw</h3>
              <label className="flex items-center justify-between text-xs text-neutral-500">
                Color
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                  className="size-7 cursor-pointer rounded border border-neutral-300"
                />
              </label>
              <SliderRow
                label="Brush size"
                min={2}
                max={40}
                unit="px"
                value={brushSize}
                onChange={setBrushSize}
              />
              <button
                type="button"
                onClick={() => history.set((d) => ({ ...d, strokes: [] }))}
                disabled={doc.strokes.length === 0}
                className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear doodles
              </button>
            </div>
          ) : toolMode === "crop" ? (
            <p className="p-4 text-xs text-neutral-500">
              Drag a rectangle on the photo, then "Apply crop" below it.
            </p>
          ) : toolMode === "lasso" ? (
            <div className="flex flex-col gap-3 p-4">
              <h3 className="text-sm font-semibold text-neutral-800">Lasso</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLassoSubTool("wand");
                    clearSelectionState();
                  }}
                  className={modeBtnClass(lassoSubTool === "wand")}
                >
                  Magic wand
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLassoSubTool("freehand");
                    clearSelectionState();
                  }}
                  className={modeBtnClass(lassoSubTool === "freehand")}
                >
                  Freehand
                </button>
              </div>
              {lassoSubTool === "wand" && (
                <SliderRow
                  label="Tolerance"
                  min={1}
                  max={100}
                  unit="%"
                  value={lassoTolerance}
                  onChange={(v) => {
                    setLassoTolerance(v);
                    if (wandSeedRef.current)
                      runWandSelect(wandSeedRef.current, v);
                  }}
                />
              )}
              <p className="text-xs text-neutral-500">
                {selectionRect
                  ? "Drag the blue corner handles to trim the sides, then choose what to do with the selection."
                  : lassoSubTool === "wand"
                    ? "Click any object or area in the photo to select it."
                    : "Drag an outline around an object in the photo."}
              </p>
              {selectionMessage && (
                <p className="text-xs text-accent">{selectionMessage}</p>
              )}
              {selectionRect && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void cutOutAsLayer()}
                    className={primaryBtnClass}
                  >
                    Cut out as layer
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSelectionAsImage()}
                    disabled={!onSaveSelection || savingSelection}
                    className="flex items-center justify-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingSelection && (
                      <SpinnerIcon className="size-3.5 animate-spin" />
                    )}
                    Save as new image
                  </button>
                  <button
                    type="button"
                    onClick={clearSelectionState}
                    className={toolBtnClass}
                  >
                    Cancel selection
                  </button>
                </div>
              )}
            </div>
          ) : toolMode === "eyedropper" ? (
            <p className="p-4 text-xs text-neutral-500">
              Click anywhere on the photo to pick a color.
            </p>
          ) : selection.type === "photo" ? (
            <div className="flex flex-col gap-4 p-4">
              {pickedMessage && (
                <p className="text-xs text-accent">{pickedMessage}</p>
              )}
              <CollapsibleSection title="Photo body">
                <div className="flex flex-col gap-3 p-3">
                  <SliderRow
                    label="Corner radius"
                    min={0}
                    max={50}
                    unit="%"
                    value={doc.photo.radius}
                    onChange={(v) =>
                      history.set((d) => ({
                        ...d,
                        photo: { ...d.photo, radius: v },
                      }))
                    }
                  />
                  <SliderRow
                    label="Opacity"
                    min={10}
                    max={100}
                    step={5}
                    unit="%"
                    value={Math.round(doc.photo.opacity * 100)}
                    onChange={(v) =>
                      history.set((d) => ({
                        ...d,
                        photo: { ...d.photo, opacity: v / 100 },
                      }))
                    }
                  />
                  <SliderRow
                    label="Border"
                    min={0}
                    max={24}
                    unit="px"
                    value={doc.photo.borderWidth}
                    onChange={(v) =>
                      history.set((d) => ({
                        ...d,
                        photo: { ...d.photo, borderWidth: v },
                      }))
                    }
                  />
                  {doc.photo.borderWidth > 0 && (
                    <label className="flex items-center justify-between text-xs text-neutral-500">
                      Border color
                      <input
                        type="color"
                        value={doc.photo.borderColor}
                        onChange={(e) =>
                          history.set((d) => ({
                            ...d,
                            photo: { ...d.photo, borderColor: e.target.value },
                          }))
                        }
                        className="size-7 cursor-pointer rounded border border-neutral-300"
                      />
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={toolBtnClass}
                    >
                      <UploadIcon className="size-3.5" />
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLibraryPicker(true)}
                      className={toolBtnClass}
                    >
                      <ImageIcon className="size-3.5" />
                      Select
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
              <AdjustmentsPanel
                adjustments={doc.adjustments}
                onChange={adjust}
                onReset={() => adjust(DEFAULT_ADJUSTMENTS)}
              />
              <button
                type="button"
                onClick={applySharpen}
                disabled={sharpening}
                className="flex items-center justify-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sharpening && (
                  <SpinnerIcon className="size-3.5 animate-spin" />
                )}
                Sharpen
              </button>
              <CollapsibleSection title="Rotate / Flip">
                <div className="flex flex-wrap gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => rotate(-1)}
                    className={toolBtnClass}
                  >
                    <RotateIcon className="size-3.5 -scale-x-100" />
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() => rotate(1)}
                    className={toolBtnClass}
                  >
                    <RotateIcon className="size-3.5" />
                    Right
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      history.set((d) => ({ ...d, flipH: !d.flipH }))
                    }
                    className={modeBtnFlatClass(doc.flipH)}
                  >
                    Flip H
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      history.set((d) => ({ ...d, flipV: !d.flipV }))
                    }
                    className={modeBtnFlatClass(doc.flipV)}
                  >
                    Flip V
                  </button>
                </div>
              </CollapsibleSection>
              <label className="flex items-center justify-between text-sm text-neutral-700">
                Background
                <input
                  type="color"
                  value={doc.background}
                  onChange={(e) =>
                    history.set((d) => ({ ...d, background: e.target.value }))
                  }
                  className="size-7 cursor-pointer rounded border border-neutral-300"
                />
              </label>
            </div>
          ) : selection.type === "section" ? (
            <BandPropertiesPanel
              key={selection.key}
              label={SECTION_BY_KEY[selection.key].label}
              vertical={
                SECTION_BY_KEY[selection.key].orientation === "vertical"
              }
              band={doc.sections[selection.key]}
              onChange={(band) => updateSection(selection.key, band)}
              onReset={() =>
                updateSection(selection.key, {
                  ...SECTION_BY_KEY[selection.key].band,
                  enabled: true,
                })
              }
            />
          ) : selectedLayer ? (
            <LayerPanel
              layer={selectedLayer}
              maxFontSize={Math.round(
                (image?.naturalWidth ?? 800) *
                  (selectedLayer.kind === "image" ? 1 : 0.25),
              )}
              minFontSize={Math.round(
                (image?.naturalWidth ?? 800) *
                  (selectedLayer.kind === "image" ? 0.03 : 0.015),
              )}
              onChange={(patch) => updateLayer(selectedLayer.id, patch)}
              onDelete={() => deleteLayer(selectedLayer.id)}
              onDuplicate={() => duplicateLayer(selectedLayer.id)}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const toolBtnClass =
  "flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50";

const primaryBtnClass =
  "flex items-center gap-1.5 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";

const modeBtnClass = (active: boolean) =>
  `flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-neutral-900 text-white"
      : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
  }`;

const modeBtnFlatClass = (active: boolean) =>
  `rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-neutral-900 text-white"
      : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
  }`;

interface LayerPanelProps {
  layer: EditorLayer;
  minFontSize: number;
  maxFontSize: number;
  onChange: (patch: Partial<EditorLayer>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function LayerPanel({
  layer,
  minFontSize,
  maxFontSize,
  onChange,
  onDelete,
  onDuplicate,
}: LayerPanelProps) {
  const isShape =
    layer.kind === "rect" || layer.kind === "ellipse" || layer.kind === "line";
  const title =
    layer.kind === "bubble"
      ? "Speech bubble"
      : layer.kind === "sticker"
        ? "Sticker"
        : layer.kind === "rect"
          ? "Rectangle"
          : layer.kind === "ellipse"
            ? "Ellipse"
            : layer.kind === "line"
              ? "Line"
              : layer.kind === "image"
                ? "Image"
                : "Text";

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate"
            className="flex size-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <CopyIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete"
            className="flex size-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {layer.kind === "sticker" ? (
        <div className="flex flex-wrap gap-1.5">
          {STICKER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange({ text: emoji })}
              className={`flex size-8 items-center justify-center rounded-md bg-white text-base ring-1 transition hover:bg-neutral-50 ${
                emoji === layer.text ? "ring-2 ring-accent" : "ring-neutral-200"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : !isShape && layer.kind !== "image" ? (
        <textarea
          value={layer.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-accent"
        />
      ) : null}

      <SliderRow
        label="Size"
        min={minFontSize}
        max={maxFontSize}
        unit="px"
        value={layer.fontSize}
        onChange={(v) => onChange({ fontSize: v })}
      />

      <SliderRow
        label="Opacity"
        min={10}
        max={100}
        step={5}
        unit="%"
        value={Math.round(layer.opacity * 100)}
        onChange={(v) => onChange({ opacity: v / 100 })}
      />

      {layer.kind !== "sticker" && layer.kind !== "image" && (
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <label className="flex items-center gap-1.5">
            {layer.kind === "bubble" ? "Text" : "Fill"}
            <input
              type="color"
              value={layer.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="size-6 cursor-pointer rounded border border-neutral-300"
            />
          </label>
          <label className="flex items-center gap-1.5">
            {layer.kind === "bubble"
              ? "Bubble"
              : isShape
                ? "Stroke"
                : "Outline"}
            <input
              type="color"
              value={layer.strokeColor}
              onChange={(e) => onChange({ strokeColor: e.target.value })}
              className="size-6 cursor-pointer rounded border border-neutral-300"
            />
          </label>
        </div>
      )}

      <CollapsibleSection
        title="Effects"
        badge={
          layer.blendMode && layer.blendMode !== "normal"
            ? "Blend"
            : layer.shadow?.enabled
              ? "Shadow"
              : undefined
        }
      >
        <div className="flex flex-col gap-3 p-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Blend mode
            <select
              value={layer.blendMode ?? "normal"}
              onChange={(e) =>
                onChange({ blendMode: e.target.value as LayerBlendMode })
              }
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800 outline-none focus:border-accent"
            >
              {BLEND_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between text-xs text-neutral-500">
            Drop shadow
            <ToggleSwitch
              checked={layer.shadow?.enabled ?? false}
              onChange={(checked) =>
                onChange({
                  shadow: {
                    ...(layer.shadow ?? DEFAULT_SHADOW),
                    enabled: checked,
                  },
                })
              }
              label="Drop shadow"
            />
          </label>
          {layer.shadow?.enabled && (
            <>
              <SliderRow
                label="Blur"
                min={0}
                max={40}
                unit="px"
                value={layer.shadow.blur}
                onChange={(v) =>
                  onChange({ shadow: { ...layer.shadow!, blur: v } })
                }
              />
              <SliderRow
                label="Offset X"
                min={-40}
                max={40}
                unit="px"
                value={layer.shadow.offsetX}
                onChange={(v) =>
                  onChange({ shadow: { ...layer.shadow!, offsetX: v } })
                }
              />
              <SliderRow
                label="Offset Y"
                min={-40}
                max={40}
                unit="px"
                value={layer.shadow.offsetY}
                onChange={(v) =>
                  onChange({ shadow: { ...layer.shadow!, offsetY: v } })
                }
              />
              <label className="flex items-center justify-between text-xs text-neutral-500">
                Shadow color
                <input
                  type="color"
                  value={layer.shadow.color}
                  onChange={(e) =>
                    onChange({
                      shadow: { ...layer.shadow!, color: e.target.value },
                    })
                  }
                  className="size-6 cursor-pointer rounded border border-neutral-300"
                />
              </label>
            </>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
