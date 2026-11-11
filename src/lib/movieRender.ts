import type {
  ClipObject,
  IdleAnimation,
  Movie,
  MovieClip,
  TransitionType,
} from "@/types/movie";
import { drawSection, sectionThickness } from "@/lib/sections";
import { drawCaption, drawSpeechBubble, type TextBounds } from "@/lib/memeText";

/** Fixed length of an entrance/exit transition — kept simple (not per-clip configurable) for v1. */
const TRANSITION_DURATION = 0.6;

/** A clip object's loaded media, ready to draw — a <video> (already seeked to the right frame
 * by the caller) or an <img>, plus its own natural pixel size for aspect-ratio math. */
export interface ClipSource {
  element: CanvasImageSource;
  naturalWidth: number;
  naturalHeight: number;
}

/** Finds the active clip and how far into it `globalT` is. Clamps to the last clip once the
 * movie's total duration is exceeded, so a caller doesn't also need an end-of-movie check. */
export function locateClip(
  clips: MovieClip[],
  globalT: number,
): { clip: MovieClip; index: number; localT: number } | null {
  let acc = 0;
  for (let i = 0; i < clips.length; i++) {
    const d = clips[i].duration;
    if (globalT < acc + d || i === clips.length - 1) {
      return {
        clip: clips[i],
        index: i,
        localT: Math.min(d, Math.max(0, globalT - acc)),
      };
    }
    acc += d;
  }
  return null;
}

export function totalDuration(clips: MovieClip[]): number {
  return clips.reduce((sum, c) => sum + c.duration, 0);
}

/** Fills in `objects`/`dialogues` for a clip saved before the multi-object scene model
 * existed, and `fontSize`/`fontFamily` for a dialogue bubble saved before those were
 * adjustable — the server only reshapes clips on write (PUT), not on read, so a movie (or
 * Slideshow, which is stored the same way) fetched straight from disk could still be in an
 * older shape. Treated as an empty scene/a default-styled bubble rather than crashing the
 * workspace. Shared by useMovies and useSlideshows. */
export function normalizeMovie(movie: Movie): Movie {
  return {
    ...movie,
    clips: (movie.clips ?? []).map((clip) => ({
      ...clip,
      objects: Array.isArray(clip.objects) ? clip.objects : [],
      dialogues: Array.isArray(clip.dialogues)
        ? clip.dialogues.map((d) => ({
            ...d,
            fontSize: d.fontSize ?? 40,
            fontFamily: d.fontFamily ?? "sans-serif",
          }))
        : [],
    })),
  };
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * The idle animation's own transform, relative to the object's own center — this is the
 * "lots of animation... crop zoom effect shake effect... 3d animation" layer, playing
 * continuously while the object is visible. `scaleX`/`skewY` fake a 3D tilt/flip on a plain
 * 2D canvas (no WebGL/3D engine): rotating a flat layer about its Y axis looks, to a flat
 * camera, almost exactly like horizontally compressing it (cos of the angle) with a slight
 * skew — a well-known cheap approximation, good enough for a tilt/wobble effect.
 */
function idleTransform(anim: IdleAnimation, localT: number, progress: number) {
  const amt = anim.intensity / 100;
  switch (anim.type) {
    case "kenburns-in":
      return {
        scale: 1 + amt * 0.35 * easeInOutQuad(progress),
        tx: 0,
        ty: 0,
        scaleX: 1,
        skewY: 0,
      };
    case "kenburns-out":
      return {
        scale: 1 + amt * 0.35 * (1 - easeInOutQuad(progress)),
        tx: 0,
        ty: 0,
        scaleX: 1,
        skewY: 0,
      };
    case "shake": {
      const px = amt * 16;
      return {
        scale: 1.06,
        tx:
          Math.sin(localT * 37) * px * 0.6 +
          Math.sin(localT * 53 + 1.7) * px * 0.4,
        ty:
          Math.cos(localT * 41) * px * 0.5 +
          Math.cos(localT * 59 + 0.9) * px * 0.5,
        scaleX: 1,
        skewY: 0,
      };
    }
    case "tilt3d": {
      const maxAngle = amt * (Math.PI / 7);
      const angle = Math.sin(localT * 1.4) * maxAngle;
      return {
        scale: 1.08,
        tx: 0,
        ty: 0,
        scaleX: Math.cos(angle),
        skewY: Math.sin(angle) * 0.18,
      };
    }
    default:
      return { scale: 1, tx: 0, ty: 0, scaleX: 1, skewY: 0 };
  }
}

function transitionPhase(
  localT: number,
  duration: number,
): { phase: "in" | "out" | null; t: number } {
  const inWindow = Math.min(TRANSITION_DURATION, duration / 2);
  const outWindow = Math.min(TRANSITION_DURATION, duration - inWindow);
  const outStart = duration - outWindow;
  if (inWindow > 0 && localT < inWindow)
    return { phase: "in", t: localT / inWindow };
  if (outWindow > 0 && localT > outStart) {
    return { phase: "out", t: (localT - outStart) / outWindow };
  }
  return { phase: null, t: 0 };
}

/** Whole-scene entrance/exit transform, active only during the first/last fraction of a
 * clip's duration — wraps every object and dialogue bubble together. */
function transitionTransform(
  type: TransitionType,
  phase: "in" | "out",
  t: number,
  areaW: number,
  areaH: number,
) {
  if (type === "none") return { tx: 0, ty: 0, scale: 1, alpha: 1 };
  // 0 = fully hidden state, 1 = fully shown/settled state.
  const progress = phase === "in" ? easeInOutQuad(t) : 1 - easeInOutQuad(t);
  switch (type) {
    case "fade":
      return { tx: 0, ty: 0, scale: 1, alpha: progress };
    case "slide-left":
      return { tx: (1 - progress) * -areaW, ty: 0, scale: 1, alpha: 1 };
    case "slide-right":
      return { tx: (1 - progress) * areaW, ty: 0, scale: 1, alpha: 1 };
    case "slide-up":
      return { tx: 0, ty: (1 - progress) * -areaH, scale: 1, alpha: 1 };
    case "slide-down":
      return { tx: 0, ty: (1 - progress) * areaH, scale: 1, alpha: 1 };
    case "zoom":
      return { tx: 0, ty: 0, scale: 0.6 + progress * 0.4, alpha: progress };
    default:
      return { tx: 0, ty: 0, scale: 1, alpha: 1 };
  }
}

/** Where (in content-area-relative 0-1 fractions) an object currently sits, for a dialogue
 * bubble to anchor itself just above. Mirrors the position drawObject uses. */
function objectAnchor(obj: ClipObject): { x: number; y: number } {
  return { x: obj.x, y: Math.max(0, obj.y - obj.width * 0.6) };
}

export interface ObjectBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Each visible object's rest-position bounding box in canvas-pixel space (content area,
 * ignoring the idle animation's live motion) — shared by drawMovieFrame and the workspace's
 * drag-to-reposition hit-testing, so "where it's drawn" and "what you can grab" never drift
 * apart.
 */
export function computeObjectBounds(
  clip: MovieClip,
  sources: Map<string, ClipSource | null>,
  areaY: number,
  areaW: number,
  areaH: number,
): Map<string, ObjectBounds> {
  const bounds = new Map<string, ObjectBounds>();
  for (const obj of clip.objects) {
    const source = sources.get(obj.id);
    if (!source) continue;
    const cx = obj.x * areaW;
    const cy = areaY + obj.y * areaH;
    const objW = obj.width * areaW;
    const aspect = source.naturalHeight / source.naturalWidth || 1;
    const objH = objW * aspect;
    bounds.set(obj.id, {
      x: cx - objW / 2,
      y: cy - objH / 2,
      w: objW,
      h: objH,
    });
  }
  return bounds;
}

export interface DrawMovieFrameParams {
  ctx: CanvasRenderingContext2D;
  movie: Movie;
  clip: MovieClip;
  /** Seconds into `clip` (not the whole movie). */
  localT: number;
  /** One loaded media element per visible object, keyed by ClipObject id — a missing/null entry just skips that object for this frame (e.g. still loading). */
  sources: Map<string, ClipSource | null>;
  canvasW: number;
  canvasH: number;
}

export interface DrawMovieFrameResult {
  /** Each dialogue bubble actually drawn this frame, by DialogueBubble id — lets the
   * workspace hit-test/drag a bubble exactly where it's really drawn (its anchor moves when
   * attached to an object), without recomputing the same text-wrapping/sizing logic twice. */
  dialogueBounds: Map<string, TextBounds>;
}

/**
 * Renders one frame: background, every object in the clip that's visible at `localT`
 * (each with its own idle animation, positioned/sized within the header/footer-aware content
 * area), the whole-scene entrance/exit transition wrapping all of them together, the
 * header/footer bands (reusing the Editor module's drawSection), and any dialogue bubbles
 * active at this instant — anchored above a specific object when attached, so two objects can
 * carry on a "conversation" with their own bubbles (reusing the Editor module's speech-bubble
 * drawing). Called every frame by both the live preview loop and the export recorder, so what
 * you see while editing is exactly what gets exported.
 */
export function drawMovieFrame({
  ctx,
  movie,
  clip,
  localT,
  sources,
  canvasW,
  canvasH,
}: DrawMovieFrameParams): DrawMovieFrameResult {
  ctx.save();
  ctx.fillStyle = movie.background;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const headerH = sectionThickness(movie.header);
  const footerH = sectionThickness(movie.footer);
  const areaY = headerH;
  const areaH = Math.max(0, canvasH - headerH - footerH);
  const areaW = canvasW;

  const { phase, t } = transitionPhase(localT, clip.duration);
  const transType =
    phase === "in"
      ? clip.transitionIn
      : phase === "out"
        ? clip.transitionOut
        : "none";
  const trans = phase
    ? transitionTransform(transType, phase, t, areaW, areaH)
    : { tx: 0, ty: 0, scale: 1, alpha: 1 };

  if (areaW > 0 && areaH > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, areaY, areaW, areaH);
    ctx.clip();
    ctx.globalAlpha = trans.alpha;
    ctx.translate(areaW / 2 + trans.tx, areaY + areaH / 2 + trans.ty);
    ctx.scale(trans.scale, trans.scale);
    ctx.translate(-areaW / 2, -(areaY + areaH / 2));

    const bounds = computeObjectBounds(clip, sources, areaY, areaW, areaH);
    for (const obj of clip.objects) {
      if (localT < obj.startSec || localT > obj.endSec) continue;
      const source = sources.get(obj.id);
      const box = bounds.get(obj.id);
      if (!source || !box) continue;

      const visibleDuration = Math.max(0.01, obj.endSec - obj.startSec);
      const objLocalT = localT - obj.startSec;
      const progress = Math.min(1, Math.max(0, objLocalT / visibleDuration));
      const idle = idleTransform(obj.idleAnimation, objLocalT, progress);

      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(idle.scale, idle.scale);
      ctx.translate(idle.tx, idle.ty);
      ctx.transform(idle.scaleX, 0, idle.skewY, 1, 0, 0);
      ctx.drawImage(source.element, -box.w / 2, -box.h / 2, box.w, box.h);
      ctx.restore();
    }
    ctx.restore();
  }

  drawSection(ctx, movie.header, 0, 0, canvasW, headerH, 0);
  drawSection(ctx, movie.footer, 0, canvasH - footerH, canvasW, footerH, 0);

  const dialogueBounds = new Map<string, TextBounds>();
  for (const d of clip.dialogues) {
    if (localT < d.startSec || localT > d.endSec) continue;
    const attached = d.attachedObjectId
      ? clip.objects.find((o) => o.id === d.attachedObjectId)
      : null;
    const anchor = attached ? objectAnchor(attached) : { x: d.x, y: d.y };
    const draw = d.style === "caption" ? drawCaption : drawSpeechBubble;
    const box = draw(
      ctx,
      d.text,
      anchor.x * areaW,
      areaY + anchor.y * areaH,
      d.fontSize,
      d.textColor,
      d.bubbleColor,
      canvasW * 0.5,
      d.fontFamily,
    );
    dialogueBounds.set(d.id, box);
  }

  ctx.restore();
  return { dialogueBounds };
}
