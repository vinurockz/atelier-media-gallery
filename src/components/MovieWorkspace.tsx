import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { EditorBand } from "@/types/editor";
import {
  ASPECT_SIZES,
  type ClipKind,
  type ClipObject,
  type Movie,
  type MovieAspect,
  type MovieClip,
} from "@/types/movie";
import type { MediaItem } from "@/types/media";
import type { MoviePatch } from "@/lib/api/movies";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import type { TextBounds } from "@/lib/memeText";
import {
  computeObjectBounds,
  drawMovieFrame,
  locateClip,
  totalDuration,
  type ClipSource,
} from "@/lib/movieRender";
import { sectionThickness } from "@/lib/sections";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { BandPropertiesPanel } from "@/components/BandPropertiesPanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EditableLabel } from "@/components/EditableLabel";
import { ImageEditor } from "@/components/ImageEditor";
import { MovieClipPanel } from "@/components/MovieClipPanel";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilmIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";

interface Props {
  movie: Movie;
  mediaItems: MediaItem[];
  onBack: () => void;
  onPatch: (patch: MoviePatch) => void;
  onDelete: () => void;
  onSaveExport: (file: File) => Promise<MediaItem | null>;
  /** Saves an edited version of an object's own image as a new file, same as the Editor module. */
  onEditMedia: (source: MediaItem, file: File) => Promise<MediaItem | null>;
  /** Uploads fresh image/video files straight from disk, landing in the file manager too —
   * same "pick from library OR upload fresh" choice Tasks/Chat already offer, for adding a
   * new scene without detouring through the Files module first. */
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
}

type Selection = { type: "movie" } | { type: "clip"; id: string };
/** Which AttachMediaModal request is open — a brand-new scene, more objects for an existing
 * one, or swapping which file a single existing object uses. */
type AddTarget =
  | { type: "newClip" }
  | { type: "object"; clipId: string }
  | { type: "replace"; clipId: string; objectId: string; kind: ClipKind }
  | null;

const ASPECTS: MovieAspect[] = ["16:9", "9:16", "1:1", "4:3"];

const DEFAULT_MOVIE_BAND: EditorBand = {
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

const SUPPORTS_EXPORT =
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  typeof HTMLCanvasElement !== "undefined" &&
  "captureStream" in HTMLCanvasElement.prototype;

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${rem}`;
}

/** Side-by-side-ish default positions for N objects freshly added together, so "add 2 clips at
 * once" gives two characters already placed apart instead of stacked on top of each other. */
function layoutSlots(n: number): { x: number; width: number }[] {
  if (n <= 1) return [{ x: 0.5, width: 0.7 }];
  if (n === 2)
    return [
      { x: 0.27, width: 0.42 },
      { x: 0.73, width: 0.42 },
    ];
  const width = Math.min(0.42, 0.85 / n);
  return Array.from({ length: n }, (_, i) => ({ x: (i + 0.5) / n, width }));
}

function newObject(
  item: MediaItem,
  slot: { x: number; width: number },
): ClipObject {
  return {
    id: crypto.randomUUID(),
    kind: item.type === "video" ? "video" : "image",
    mediaItemId: item.id,
    x: slot.x,
    y: 0.5,
    width: slot.width,
    trimStart: 0,
    muted: false,
    idleAnimation: { type: "none", intensity: 30 },
    startSec: 0,
    endSec: 1e6,
  };
}

function newClip(items: MediaItem[]): MovieClip {
  const slots = layoutSlots(items.length);
  return {
    id: crypto.randomUUID(),
    duration: 4,
    transitionIn: "fade",
    transitionOut: "fade",
    objects: items.map((item, i) => newObject(item, slots[i])),
    dialogues: [],
  };
}

const iconBtnClass =
  "flex size-7 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30";

const primaryBtnClass =
  "flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Timeline editor for one movie: a left clip rail (add/reorder/remove scenes), a center
 * preview, and a right panel that's either the movie's own settings (aspect, background,
 * header/footer bands) or the selected scene's (objects placed in it, each with its own
 * animation, plus dialogue). Export re-records the whole timeline in real time via
 * canvas.captureStream() + MediaRecorder — same no-new-dependency approach the Editor
 * module's video trim export already uses — so there's no hard duration limit, just however
 * long the movie actually plays.
 */
export function MovieWorkspace({
  movie,
  mediaItems,
  onBack,
  onPatch,
  onDelete,
  onSaveExport,
  onEditMedia,
  onImportFiles,
}: Props) {
  const [selection, setSelection] = useState<Selection>({ type: "movie" });
  const [uploadingScene, setUploadingScene] = useState(false);
  const sceneFileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  // The object (and its current image) being edited in the full Image Editor overlay.
  const [editingObject, setEditingObject] = useState<{
    clipId: string;
    objectId: string;
    item: MediaItem;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<AddTarget>(null);
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>(
    {},
  );
  // Live drag preview for repositioning an object or a dialogue bubble on the canvas — local,
  // non-committed state during the gesture, same pattern the Editor module's layer dragging
  // uses (ImageEditor's dragPreview), committed as a single patch on pointer-up instead of on
  // every move.
  const [dragPreview, setDragPreview] = useState<
    | { kind: "object"; objectId: string; x: number; y: number }
    | { kind: "dialogue"; dialogueId: string; x: number; y: number }
    | null
  >(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const playerRef = useRef<{
    activeIndex: number;
    clipStartWall: number;
  } | null>(null);
  const pausedLocalTRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const loopingRef = useRef(false);
  const exportingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const dialogueBoundsRef = useRef<Map<string, TextBounds>>(new Map());
  const dragRef = useRef<
    | {
        kind: "object";
        clipId: string;
        objectId: string;
        dx: number;
        dy: number;
      }
    | {
        kind: "dialogue";
        clipId: string;
        dialogueId: string;
        dx: number;
        dy: number;
      }
    | null
  >(null);

  const clips = movie.clips;
  const { width, height } = ASPECT_SIZES[movie.aspect];
  const totalSec = totalDuration(clips);
  const selectedClip =
    selection.type === "clip"
      ? (clips.find((c) => c.id === selection.id) ?? null)
      : null;

  useEffect(() => {
    const videoEls = videoElsRef.current;
    return () => {
      loopingRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      videoEls.forEach((v) => {
        v.pause();
        v.removeAttribute("src");
      });
      videoEls.clear();
    };
  }, []);

  // Probes a video object's own natural duration once, so its trim slider has a real bound.
  useEffect(() => {
    if (!selectedClip) return;
    for (const obj of selectedClip.objects) {
      if (obj.kind !== "video" || videoDurations[obj.mediaItemId] !== undefined)
        continue;
      const item = mediaItems.find((m) => m.id === obj.mediaItemId);
      if (!item) continue;
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.onloadedmetadata = () => {
        setVideoDurations((prev) =>
          prev[item.id] !== undefined
            ? prev
            : { ...prev, [item.id]: probe.duration },
        );
      };
      probe.src = item.src;
    }
  }, [selectedClip, mediaItems, videoDurations]);

  const getMediaItem = (id: string) =>
    mediaItems.find((m) => m.id === id) ?? null;

  const preloadImage = async (src: string): Promise<HTMLImageElement> => {
    const cached = imageCacheRef.current.get(src);
    if (cached) return cached;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = src;
    });
    imageCacheRef.current.set(src, img);
    return img;
  };

  /** Preloads an object's media without touching playback position/timing — unlike
   * activateClip, which also seeks/plays. Used to pick up a just-edited/replaced object's new
   * file so it shows up without the clip's elapsed-time clock jumping back to 0. */
  const ensureObjectLoaded = async (obj: ClipObject) => {
    const item = getMediaItem(obj.mediaItemId);
    if (!item) return;
    if (obj.kind === "video") {
      let video = videoElsRef.current.get(obj.id);
      if (!video) {
        video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.playsInline = true;
        video.muted = true;
        videoElsRef.current.set(obj.id, video);
      }
      if (video.src !== item.src) {
        video.src = item.src;
        video.pause();
        await new Promise<void>((resolve) => {
          video!.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          });
        });
      }
    } else {
      await preloadImage(item.src).catch(() => {});
    }
  };

  /** Activates clip `index`: loads/seeks every object's media, starting video objects
   * playing (or just priming them, paused, when `play` is false). */
  const activateClip = async (index: number, play: boolean) => {
    const clip = clips[index];
    if (!clip) return;
    playerRef.current = {
      activeIndex: index,
      clipStartWall: performance.now(),
    };

    const neededIds = new Set(
      clip.objects.filter((o) => o.kind === "video").map((o) => o.id),
    );
    for (const [objId, video] of videoElsRef.current) {
      if (!neededIds.has(objId)) {
        video.pause();
        video.removeAttribute("src");
        videoElsRef.current.delete(objId);
      }
    }

    await Promise.all(
      clip.objects.map(async (obj) => {
        const item = getMediaItem(obj.mediaItemId);
        if (!item) return;
        if (obj.kind === "video") {
          let video = videoElsRef.current.get(obj.id);
          if (!video) {
            video = document.createElement("video");
            video.crossOrigin = "anonymous";
            video.playsInline = true;
            videoElsRef.current.set(obj.id, video);
          }
          if (video.src !== item.src) {
            video.src = item.src;
            await new Promise<void>((resolve) => {
              video!.addEventListener("loadedmetadata", () => resolve(), {
                once: true,
              });
            });
          }
          video.muted = obj.muted;
          video.currentTime = obj.trimStart;
          await new Promise<void>((resolve) => {
            video!.addEventListener("seeked", () => resolve(), { once: true });
          });
          if (play) {
            try {
              await video.play();
            } catch {
              // Autoplay blocked — the frame still draws, just won't advance via playback.
            }
            if (
              exportingRef.current &&
              combinedStreamRef.current &&
              !obj.muted
            ) {
              try {
                type CaptureVideo = HTMLVideoElement & {
                  captureStream?: () => MediaStream;
                };
                const track = (video as CaptureVideo)
                  .captureStream?.()
                  .getAudioTracks()[0];
                if (track) combinedStreamRef.current.addTrack(track);
              } catch {
                // No audio track available for this object.
              }
            }
          } else {
            video.pause();
          }
        } else {
          await preloadImage(item.src).catch(() => {});
        }
      }),
    );
  };

  const getClipLocalT = (): number => {
    if (!playerRef.current) return 0;
    // Frozen while paused — clipStartWall is a fixed point in the past, so without this,
    // reading the wall clock keeps advancing "localT" the whole time the editor sits open,
    // eventually overshooting the clip's own duration (animations look wrong/maxed-out).
    if (!loopingRef.current) return pausedLocalTRef.current;
    return Math.max(
      0,
      (performance.now() - playerRef.current.clipStartWall) / 1000,
    );
  };

  const buildSources = (clip: MovieClip): Map<string, ClipSource | null> => {
    const sources = new Map<string, ClipSource | null>();
    for (const obj of clip.objects) {
      const item = getMediaItem(obj.mediaItemId);
      if (!item) {
        sources.set(obj.id, null);
        continue;
      }
      if (obj.kind === "video") {
        const video = videoElsRef.current.get(obj.id);
        sources.set(
          obj.id,
          video && video.readyState >= 2
            ? {
                element: video,
                naturalWidth: video.videoWidth,
                naturalHeight: video.videoHeight,
              }
            : null,
        );
      } else {
        const img = imageCacheRef.current.get(item.src);
        sources.set(
          obj.id,
          img
            ? {
                element: img,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
              }
            : null,
        );
      }
    }
    return sources;
  };

  /** The content area's geometry (below the header, above the footer) in canvas-pixel space —
   * what object x/y/width are relative to. Shared by drawing and drag hit-testing. */
  const getContentArea = () => {
    const headerH = sectionThickness(movie.header);
    const footerH = sectionThickness(movie.footer);
    return {
      areaY: headerH,
      areaH: Math.max(0, height - headerH - footerH),
      areaW: width,
    };
  };

  const drawCurrentFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !playerRef.current) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const clip = clips[playerRef.current.activeIndex];
    if (!clip) return;
    // While dragging an object or a dialogue bubble, show it following the pointer instead of
    // its saved position — same "local preview state during a drag, one commit on release"
    // pattern the Editor module's layer dragging uses. A dragged dialogue also previews as
    // free-floating (ignoring any attachedObjectId) since dropping it detaches it.
    let displayClip = clip;
    if (
      dragPreview?.kind === "object" &&
      clip.objects.some((o) => o.id === dragPreview.objectId)
    ) {
      displayClip = {
        ...clip,
        objects: clip.objects.map((o) =>
          o.id === dragPreview.objectId
            ? { ...o, x: dragPreview.x, y: dragPreview.y }
            : o,
        ),
      };
    } else if (
      dragPreview?.kind === "dialogue" &&
      clip.dialogues.some((d) => d.id === dragPreview.dialogueId)
    ) {
      displayClip = {
        ...clip,
        dialogues: clip.dialogues.map((d) =>
          d.id === dragPreview.dialogueId
            ? {
                ...d,
                x: dragPreview.x,
                y: dragPreview.y,
                attachedObjectId: null,
              }
            : d,
        ),
      };
    }
    const sources = buildSources(displayClip);
    const result = drawMovieFrame({
      ctx,
      movie,
      clip: displayClip,
      localT: getClipLocalT(),
      sources,
      canvasW: width,
      canvasH: height,
    });
    dialogueBoundsRef.current = result.dialogueBounds;
  };

  // --- Drag an object directly on the canvas to reposition it ----------------------------

  const toCanvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!selectedClip || isPlaying || exporting) return;
    const p = toCanvasPoint(e);
    const { areaY, areaW, areaH } = getContentArea();

    // Dialogue bubbles are drawn on top of objects, so they get first pick at the hit-test.
    for (let i = selectedClip.dialogues.length - 1; i >= 0; i--) {
      const d = selectedClip.dialogues[i];
      const b = dialogueBoundsRef.current.get(d.id);
      if (
        b &&
        p.x >= b.x &&
        p.x <= b.x + b.width &&
        p.y >= b.y &&
        p.y <= b.y + b.height
      ) {
        dragRef.current = {
          kind: "dialogue",
          clipId: selectedClip.id,
          dialogueId: d.id,
          dx: p.x - (b.x + b.width / 2),
          dy: p.y - (b.y + b.height / 2),
        };
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }

    const sources = buildSources(selectedClip);
    const bounds = computeObjectBounds(
      selectedClip,
      sources,
      areaY,
      areaW,
      areaH,
    );
    for (let i = selectedClip.objects.length - 1; i >= 0; i--) {
      const obj = selectedClip.objects[i];
      const b = bounds.get(obj.id);
      if (
        b &&
        p.x >= b.x &&
        p.x <= b.x + b.w &&
        p.y >= b.y &&
        p.y <= b.y + b.h
      ) {
        dragRef.current = {
          kind: "object",
          clipId: selectedClip.id,
          objectId: obj.id,
          dx: p.x - (b.x + b.w / 2),
          dy: p.y - (b.y + b.h / 2),
        };
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const p = toCanvasPoint(e);
    const { areaY, areaW, areaH } = getContentArea();
    const relX = Math.min(1, Math.max(0, (p.x - dragRef.current.dx) / areaW));
    const relY = Math.min(
      1,
      Math.max(0, (p.y - dragRef.current.dy - areaY) / areaH),
    );
    if (dragRef.current.kind === "object") {
      setDragPreview({
        kind: "object",
        objectId: dragRef.current.objectId,
        x: relX,
        y: relY,
      });
    } else {
      setDragPreview({
        kind: "dialogue",
        dialogueId: dragRef.current.dialogueId,
        x: relX,
        y: relY,
      });
    }
  };

  const onCanvasPointerUp = () => {
    if (dragRef.current && dragPreview) {
      const { clipId } = dragRef.current;
      const clip = clips.find((c) => c.id === clipId);
      if (clip) {
        if (
          dragRef.current.kind === "object" &&
          dragPreview.kind === "object"
        ) {
          const { objectId } = dragRef.current;
          const { x, y } = dragPreview;
          patchClip(clipId, {
            objects: clip.objects.map((o) =>
              o.id === objectId ? { ...o, x, y } : o,
            ),
          });
        } else if (
          dragRef.current.kind === "dialogue" &&
          dragPreview.kind === "dialogue"
        ) {
          const { dialogueId } = dragRef.current;
          const { x, y } = dragPreview;
          patchClip(clipId, {
            dialogues: clip.dialogues.map((d) =>
              d.id === dialogueId ? { ...d, x, y, attachedObjectId: null } : d,
            ),
          });
        }
      }
    }
    dragRef.current = null;
    setDragPreview(null);
  };

  const finishPlayback = () => {
    loopingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    videoElsRef.current.forEach((v) => v.pause());
    setIsPlaying(false);
    if (exportingRef.current) {
      exportingRef.current = false;
      mediaRecorderRef.current?.stop();
    }
  };

  const tick = async () => {
    if (!playerRef.current) return;
    const index = playerRef.current.activeIndex;
    const clip = clips[index];
    if (!clip) {
      finishPlayback();
      return;
    }
    const localT = getClipLocalT();
    if (localT >= clip.duration) {
      const nextIndex = index + 1;
      if (nextIndex >= clips.length) {
        drawCurrentFrame();
        finishPlayback();
        return;
      }
      await activateClip(nextIndex, true);
    }
    drawCurrentFrame();
    const active = playerRef.current?.activeIndex ?? index;
    const cum = clips.slice(0, active).reduce((s, c) => s + c.duration, 0);
    const now = cum + getClipLocalT();
    setDisplayTime(now);
    if (exportingRef.current && totalSec > 0) {
      setExportProgress(Math.min(1, now / totalSec));
    }
    if (loopingRef.current)
      rafRef.current = requestAnimationFrame(() => void tick());
  };

  const pausePlayback = () => {
    if (playerRef.current) pausedLocalTRef.current = getClipLocalT();
    loopingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    videoElsRef.current.forEach((v) => v.pause());
    setIsPlaying(false);
  };

  const startPlayback = async (fromIndex: number) => {
    if (clips.length === 0) return;
    setError(null);
    await activateClip(fromIndex, true);
    loopingRef.current = true;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(() => void tick());
  };

  /** Continues from exactly where pausePlayback left off, instead of re-activating the clip
   * (which would reset every video object's currentTime back to its own trim start). */
  const resumePlayback = async () => {
    if (!playerRef.current || clips.length === 0) return;
    setError(null);
    playerRef.current.clipStartWall =
      performance.now() - pausedLocalTRef.current * 1000;
    const clip = clips[playerRef.current.activeIndex];
    if (clip) {
      await Promise.all(
        clip.objects
          .filter((o) => o.kind === "video")
          .map(async (o) => {
            const video = videoElsRef.current.get(o.id);
            if (!video) return;
            try {
              await video.play();
            } catch {
              // ignore
            }
          }),
      );
    }
    loopingRef.current = true;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(() => void tick());
  };

  const togglePlayback = () => {
    if (isPlaying) {
      pausePlayback();
      return;
    }
    if (playerRef.current && displayTime < totalSec) {
      void resumePlayback();
    } else {
      void startPlayback(0);
    }
  };

  const handleSeek = async (fraction: number) => {
    if (clips.length === 0) return;
    const target = Math.min(totalSec, Math.max(0, fraction * totalSec));
    const located = locateClip(clips, target);
    if (!located) return;
    const wasPlaying = isPlaying;
    pausePlayback();
    await activateClip(located.index, false);
    pausedLocalTRef.current = located.localT;
    if (playerRef.current) {
      playerRef.current.clipStartWall =
        performance.now() - located.localT * 1000;
    }
    const clip = clips[located.index];
    await Promise.all(
      clip.objects
        .filter((o) => o.kind === "video")
        .map(async (o) => {
          const video = videoElsRef.current.get(o.id);
          if (!video) return;
          const objLocalT = Math.max(0, located.localT - o.startSec);
          video.currentTime = o.trimStart + objLocalT;
          await new Promise<void>((resolve) => {
            video.addEventListener("seeked", () => resolve(), { once: true });
          });
        }),
    );
    drawCurrentFrame();
    setDisplayTime(target);
    if (wasPlaying) {
      loopingRef.current = true;
      setIsPlaying(true);
      await Promise.all(
        clip.objects
          .filter((o) => o.kind === "video")
          .map(async (o) => {
            const video = videoElsRef.current.get(o.id);
            if (!video) return;
            try {
              await video.play();
            } catch {
              // ignore
            }
          }),
      );
      rafRef.current = requestAnimationFrame(() => void tick());
    }
  };

  const handleExport = async () => {
    if (!SUPPORTS_EXPORT) {
      setError("Movie export isn't supported in this browser.");
      return;
    }
    if (clips.length === 0 || clips.every((c) => c.objects.length === 0)) {
      setError("Add at least one clip with something in it first.");
      return;
    }
    pausePlayback();
    setError(null);
    setExporting(true);
    setExportProgress(0);
    exportingRef.current = true;

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas unavailable");
      canvas.width = width;
      canvas.height = height;

      type CaptureCanvas = HTMLCanvasElement & {
        captureStream: (fps?: number) => MediaStream;
      };
      const canvasStream = (canvas as CaptureCanvas).captureStream(30);
      const combined = new MediaStream(canvasStream.getVideoTracks());
      combinedStreamRef.current = combined;

      // Best-effort audio: as each clip activates, activateClip adds any unmuted video
      // object's live audio track to this stream (see above). Minor hiccups right at scene
      // boundaries are a known tradeoff, not treated as a correctness bug.
      await activateClip(0, true);
      drawCurrentFrame();

      const mimeType =
        [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = new MediaRecorder(
        combined,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const recorded = new Promise<Blob>((resolve) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      });

      recorder.start();
      loopingRef.current = true;
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(() => void tick());

      const blob = await recorded;
      const file = new File([blob], `${movie.title}.webm`, {
        type: blob.type || "video/webm",
      });
      const result = await onSaveExport(file);
      if (!result)
        setError("Export finished but couldn't be saved to your library.");
    } catch (err) {
      console.error("Movie export failed", err);
      setError("Couldn't export this movie — see console for details.");
    } finally {
      exportingRef.current = false;
      setExporting(false);
      mediaRecorderRef.current = null;
      combinedStreamRef.current = null;
    }
  };

  // Loads the first clip's media as soon as there is one, so the preview shows something
  // before the user hits Play or picks a clip.
  const firstClipId = clips[0]?.id;
  useEffect(() => {
    if (!firstClipId || isPlaying || exporting) return;
    void activateClip(0, false).then(() => drawCurrentFrame());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstClipId]);

  // Redraws once whenever the document (or a live drag) changes and playback isn't already
  // driving the canvas — first making sure every object in the active clip is actually
  // loaded, since an edited/replaced object's new file won't be in videoElsRef/imageCacheRef
  // yet (that only normally happens when a clip activates).
  useEffect(() => {
    if (isPlaying || exporting || !playerRef.current) return;
    const clip = clips[playerRef.current.activeIndex];
    if (!clip) return;
    void Promise.all(clip.objects.map(ensureObjectLoaded)).then(() =>
      drawCurrentFrame(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie, isPlaying, exporting, dragPreview]);

  const updateClips = (next: MovieClip[]) => onPatch({ clips: next });

  const patchClip = (id: string, patch: Partial<MovieClip>) => {
    updateClips(clips.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeClip = (id: string) => {
    updateClips(clips.filter((c) => c.id !== id));
    setSelection((prev) =>
      prev.type === "clip" && prev.id === id ? { type: "movie" } : prev,
    );
  };

  const moveClip = (id: string, dir: -1 | 1) => {
    const idx = clips.findIndex((c) => c.id === id);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= clips.length) return;
    const next = [...clips];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateClips(next);
  };

  const handleSceneUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingScene(true);
    try {
      const result = await onImportFiles(files);
      if (result.items.length > 0) {
        const clip = newClip(result.items);
        updateClips([...clips, clip]);
        setSelection({ type: "clip", id: clip.id });
      }
    } finally {
      setUploadingScene(false);
    }
  };

  const handleAddConfirm = (items: MediaItem[]) => {
    if (!addTarget || items.length === 0) {
      setAddTarget(null);
      return;
    }
    if (addTarget.type === "newClip") {
      const clip = newClip(items);
      updateClips([...clips, clip]);
      setSelection({ type: "clip", id: clip.id });
    } else if (addTarget.type === "object") {
      const clip = clips.find((c) => c.id === addTarget.clipId);
      if (clip) {
        // Spread the newly added ones out (same side-by-side layout a fresh scene gets)
        // instead of stacking them all on the exact same spot — existing objects keep
        // whatever position they were already dragged to.
        const slots = layoutSlots(items.length);
        patchClip(clip.id, {
          objects: [
            ...clip.objects,
            ...items.map((item, i) => newObject(item, slots[i])),
          ],
        });
      }
    } else {
      // "replace" — swap which file an existing object uses, keeping its position/size/
      // animation/timing exactly as they were.
      const clip = clips.find((c) => c.id === addTarget.clipId);
      const picked = items[0];
      if (clip && picked) {
        patchClip(clip.id, {
          objects: clip.objects.map((o) =>
            o.id === addTarget.objectId
              ? { ...o, mediaItemId: picked.id, trimStart: 0 }
              : o,
          ),
        });
      }
    }
    setAddTarget(null);
  };

  /** Opens the object's current image in the full Image Editor — same tool the Files module
   * uses, reused here instead of building a second set of editing tools inside Movies. */
  const openEditImage = (clipId: string, objectId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    const obj = clip?.objects.find((o) => o.id === objectId);
    if (!obj || obj.kind !== "image") return;
    const item = getMediaItem(obj.mediaItemId);
    if (!item) return;
    pausePlayback();
    setEditingObject({ clipId, objectId, item });
  };

  /** The Image Editor always saves as a new file (never overwrites the source) — once that
   * new file exists, point the object at it so the edit shows up in the movie. */
  const handleImageEditSave = async (file: File) => {
    if (!editingObject) return;
    const result = await onEditMedia(editingObject.item, file);
    if (result) {
      patchClip(editingObject.clipId, {
        objects: (
          clips.find((c) => c.id === editingObject.clipId)?.objects ?? []
        ).map((o) =>
          o.id === editingObject.objectId
            ? { ...o, mediaItemId: result.id }
            : o,
        ),
      });
    }
    setEditingObject(null);
  };

  const selectClipAndSeek = (id: string) => {
    setSelection({ type: "clip", id });
    const idx = clips.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const start = clips.slice(0, idx).reduce((s, c) => s + c.duration, 0);
    void handleSeek(totalSec > 0 ? start / totalSec : 0);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-linen bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to movies"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <EditableLabel
          value={movie.title}
          onCommit={(next) => onPatch({ title: next })}
          className="min-w-0 flex-1 text-base font-medium text-ink"
        />
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || clips.length === 0}
          className={primaryBtnClass}
        >
          {exporting ? (
            <SpinnerIcon className="size-3.5 animate-spin" />
          ) : (
            <DownloadIcon className="size-3.5" />
          )}
          {exporting
            ? `Exporting ${Math.round(exportProgress * 100)}%`
            : "Export"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete movie"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      {error && (
        <p className="shrink-0 bg-red-50 px-4 py-1.5 text-center text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white p-2">
          <button
            type="button"
            onClick={() => setSelection({ type: "movie" })}
            className={`mb-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
              selection.type === "movie"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
            }`}
          >
            Movie settings
          </button>

          <div className="flex flex-col gap-1.5">
            {clips.map((clip, i) => {
              const firstObj = clip.objects[0];
              const item = firstObj ? getMediaItem(firstObj.mediaItemId) : null;
              return (
                <div
                  key={clip.id}
                  className={`flex items-center gap-1.5 rounded-md p-1 ring-1 transition ${
                    selection.type === "clip" && selection.id === clip.id
                      ? "bg-accent/10 ring-accent"
                      : "bg-white ring-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectClipAndSeek(clip.id)}
                    className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-200"
                  >
                    {item?.type === "image" ? (
                      <img
                        src={item.src}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : item?.type === "video" ? (
                      <video
                        src={item.src}
                        muted
                        playsInline
                        preload="metadata"
                        className="size-full object-cover"
                      />
                    ) : (
                      <FilmIcon className="size-4 text-neutral-400" />
                    )}
                    {clip.objects.length > 1 && (
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] font-semibold text-white">
                        +{clip.objects.length - 1}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectClipAndSeek(clip.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-medium text-neutral-800">
                      {clip.objects.length === 0
                        ? "Empty scene"
                        : item?.title
                          ? item.title
                          : "Scene"}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] text-neutral-400">
                      {clip.duration.toFixed(1)}s · {clip.objects.length}{" "}
                      {clip.objects.length === 1 ? "object" : "objects"}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => moveClip(clip.id, -1)}
                      disabled={i === 0}
                      aria-label="Move clip earlier"
                      className="flex size-5 items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
                    >
                      <ChevronLeftIcon className="size-3 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveClip(clip.id, 1)}
                      disabled={i === clips.length - 1}
                      aria-label="Move clip later"
                      className="flex size-5 items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
                    >
                      <ChevronRightIcon className="size-3 rotate-90" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              pausePlayback();
              setAddTarget({ type: "newClip" });
            }}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-neutral-300 px-2.5 py-2 text-xs font-medium text-neutral-400 transition hover:border-accent/50 hover:text-accent"
          >
            <PlusIcon className="size-3.5" />
            Add scene
          </button>
          <button
            type="button"
            onClick={() => sceneFileInputRef.current?.click()}
            disabled={uploadingScene}
            className="mt-1.5 flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-2 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            {uploadingScene ? (
              <SpinnerIcon className="size-3.5 animate-spin" />
            ) : (
              <UploadIcon className="size-3.5" />
            )}
            Upload image/video
          </button>
          <input
            ref={sceneFileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => void handleSceneUpload(e)}
            className="hidden"
          />
          <p className="mt-1.5 px-1 text-[10px] leading-snug text-neutral-400">
            Pick more than one file to put several objects in the same scene —
            e.g. two characters that can talk to each other.
          </p>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-neutral-900 p-6">
          {clips.length === 0 ? (
            <p className="text-sm text-white/50">
              Add a scene from the left to start building this movie.
            </p>
          ) : (
            <canvas
              ref={canvasRef}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerLeave={onCanvasPointerUp}
              className={`touch-none rounded-lg shadow-lg ${
                selectedClip && !isPlaying && !exporting
                  ? "cursor-grab active:cursor-grabbing"
                  : ""
              }`}
              style={{
                width: "auto",
                height: "auto",
                maxWidth: "100%",
                maxHeight: "75%",
              }}
            />
          )}

          <div className="flex w-full max-w-xl items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              disabled={clips.length === 0 || exporting}
              className={iconBtnClass}
            >
              {isPlaying ? (
                <PauseIcon className="size-4" />
              ) : (
                <PlayIcon className="size-4" />
              )}
            </button>
            <span className="w-20 shrink-0 text-center text-xs tabular-nums text-white/60">
              {formatSeconds(displayTime)} / {formatSeconds(totalSec)}
            </span>
            <div
              className="h-1.5 w-full cursor-pointer rounded-full bg-white/20"
              onClick={(e) => {
                if (clips.length === 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                void handleSeek((e.clientX - rect.left) / rect.width);
              }}
            >
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${totalSec > 0 ? Math.min(100, (displayTime / totalSec) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white">
          {selectedClip ? (
            <MovieClipPanel
              clip={selectedClip}
              mediaItems={mediaItems}
              knownVideoDurations={videoDurations}
              onChange={(patch) => patchClip(selectedClip.id, patch)}
              onDelete={() => removeClip(selectedClip.id)}
              onAddObject={() => {
                pausePlayback();
                setAddTarget({ type: "object", clipId: selectedClip.id });
              }}
              onEditImage={(objectId) =>
                openEditImage(selectedClip.id, objectId)
              }
              onReplaceObject={(objectId, kind) => {
                pausePlayback();
                setAddTarget({
                  type: "replace",
                  clipId: selectedClip.id,
                  objectId,
                  kind,
                });
              }}
            />
          ) : (
            <div className="flex flex-col gap-4 p-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Aspect ratio
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ASPECTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onPatch({ aspect: a })}
                      className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                        movie.aspect === a
                          ? "bg-neutral-900 text-white"
                          : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between text-sm text-neutral-700">
                Background
                <input
                  type="color"
                  value={movie.background}
                  onChange={(e) => onPatch({ background: e.target.value })}
                  className="size-7 cursor-pointer rounded border border-neutral-300"
                />
              </label>

              <CollapsibleSection
                title="Header"
                badge={movie.header.enabled ? "On" : "Off"}
              >
                <BandPropertiesPanel
                  label="Header"
                  band={movie.header}
                  onChange={(band) => onPatch({ header: band })}
                  onReset={() => onPatch({ header: { ...DEFAULT_MOVIE_BAND } })}
                />
              </CollapsibleSection>

              <CollapsibleSection
                title="Footer"
                badge={movie.footer.enabled ? "On" : "Off"}
              >
                <BandPropertiesPanel
                  label="Footer"
                  band={movie.footer}
                  onChange={(band) => onPatch({ footer: band })}
                  onReset={() => onPatch({ footer: { ...DEFAULT_MOVIE_BAND } })}
                />
              </CollapsibleSection>
            </div>
          )}
        </aside>
      </div>

      {addTarget && (
        <AttachMediaModal
          items={mediaItems.filter((m) => m.type !== "pdf")}
          multiple={addTarget.type !== "replace"}
          typeFilter={addTarget.type === "replace" ? addTarget.kind : undefined}
          title={
            addTarget.type === "newClip"
              ? "Add a scene"
              : addTarget.type === "object"
                ? "Add object to this scene"
                : "Replace with"
          }
          onClose={() => setAddTarget(null)}
          onConfirm={(ids) => {
            const items = ids
              .map((id) => mediaItems.find((m) => m.id === id))
              .filter((m): m is MediaItem => m !== undefined);
            handleAddConfirm(items);
          }}
        />
      )}

      {editingObject && (
        <div className="fixed inset-0 z-50 bg-white">
          <ImageEditor
            item={editingObject.item}
            mediaItems={mediaItems}
            onSave={handleImageEditSave}
            onCancel={() => setEditingObject(null)}
          />
        </div>
      )}
    </div>
  );
}
