import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/types/media";
import type { Rotation } from "@/types/editor";
import { drawMemeText, drawSticker } from "@/lib/memeText";
import {
  DEFAULT_ADJUSTMENTS,
  drawAdjusted,
  type Adjustments,
} from "@/lib/canvasDraw";
import { AdjustmentsPanel } from "@/components/AdjustmentsPanel";
import { EditorTopBar } from "@/components/EditorTopBar";
import { SliderRow } from "@/components/SliderRow";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  PauseIcon,
  PlayIcon,
  RotateIcon,
  ScissorsIcon,
  TextIcon,
} from "@/components/icons";

interface VideoEditorProps {
  item: MediaItem;
  onSave: (file: File) => Promise<void>;
  onCancel: () => void;
}

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
const SPEED_OPTIONS = [0.5, 1, 1.5, 2];
const WATERMARK_EMOJIS = ["", "😂", "🔥", "💯", "👽", "💀", "✨"];

const SUPPORTS_VIDEO_EXPORT =
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  typeof HTMLCanvasElement !== "undefined" &&
  "captureStream" in HTMLCanvasElement.prototype &&
  typeof HTMLVideoElement !== "undefined" &&
  "captureStream" in HTMLVideoElement.prototype;

const pillBtnClass = (active: boolean) =>
  `rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-neutral-900 text-white"
      : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
  }`;

const toolBtnClass =
  "flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50";

const sectionRowClass = (active: boolean) =>
  `flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
    active
      ? "bg-accent/10 text-accent"
      : "text-neutral-700 hover:bg-neutral-100"
  }`;

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${rem}`;
}

type VideoSection =
  "trim" | "captions" | "adjustments" | "transform" | "watermark";

const SECTIONS: { id: VideoSection; label: string }[] = [
  { id: "trim", label: "Trim range" },
  { id: "captions", label: "Captions" },
  { id: "adjustments", label: "Adjustments" },
  { id: "transform", label: "Rotate, flip & crop" },
  { id: "watermark", label: "Watermark & audio" },
];

/**
 * Trims a video to a chosen range and (optionally) burns in top/bottom
 * captions, Photoshop-style adjustments, rotation/flip, crop margins, a
 * watermark, and a speed change — saving the result as a new video in the
 * file manager. Laid out like the photo editor: a left section list and a
 * context-sensitive right panel. Re-records the clip in real time via
 * canvas.captureStream() + MediaRecorder rather than pulling in
 * ffmpeg.wasm — no new dependency, output is WebM (this project already
 * treats WebM as a native, directly playable format).
 */
export function VideoEditor({ item, onSave, onCancel }: VideoEditorProps) {
  const [section, setSection] = useState<VideoSection>("trim");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [fontSize, setFontSize] = useState(36);
  const [adjustments, setAdjustments] =
    useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [watermark, setWatermark] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /**
   * Draws the current video frame plus every live edit (adjustments, rotate,
   * flip, crop, captions, watermark) into the visible preview canvas — the
   * exact same composition `handleExport` records frame-by-frame, so the
   * canvas the user sees while editing matches the exported file.
   */
  const drawComposedFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0)
      return;
    if (!fullCanvasRef.current)
      fullCanvasRef.current = document.createElement("canvas");
    const full = fullCanvasRef.current;

    const rotated = rotation === 90 || rotation === 270;
    const fullW = rotated ? video.videoHeight : video.videoWidth;
    const fullH = rotated ? video.videoWidth : video.videoHeight;
    const cropLeftPx = Math.round((cropLeft / 100) * fullW);
    const cropRightPx = Math.round((cropRight / 100) * fullW);
    const cropTopPx = Math.round((cropTop / 100) * fullH);
    const cropBottomPx = Math.round((cropBottom / 100) * fullH);
    const outW = Math.max(1, fullW - cropLeftPx - cropRightPx);
    const outH = Math.max(1, fullH - cropTopPx - cropBottomPx);

    full.width = fullW;
    full.height = fullH;
    const fctx = full.getContext("2d");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!fctx || !ctx) return;

    fctx.save();
    fctx.translate(fullW / 2, fullH / 2);
    fctx.rotate((rotation * Math.PI) / 180);
    fctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    drawAdjusted(
      fctx,
      video,
      -video.videoWidth / 2,
      -video.videoHeight / 2,
      video.videoWidth,
      video.videoHeight,
      adjustments,
    );
    fctx.restore();

    ctx.drawImage(full, cropLeftPx, cropTopPx, outW, outH, 0, 0, outW, outH);

    const margin = Math.max(fontSize, canvas.height * 0.08);
    if (topText) {
      drawMemeText(
        ctx,
        topText,
        canvas.width / 2,
        margin,
        fontSize,
        "#ffffff",
        "#000000",
        canvas.width * 0.92,
      );
    }
    if (bottomText) {
      drawMemeText(
        ctx,
        bottomText,
        canvas.width / 2,
        canvas.height - margin,
        fontSize,
        "#ffffff",
        "#000000",
        canvas.width * 0.92,
      );
    }
    if (watermark) {
      const size = Math.round(canvas.height * 0.1);
      drawSticker(
        ctx,
        watermark,
        canvas.width - size * 0.7,
        canvas.height - size * 0.7,
        size,
      );
    }
  }, [
    rotation,
    flipH,
    flipV,
    cropLeft,
    cropRight,
    cropTop,
    cropBottom,
    adjustments,
    fontSize,
    topText,
    bottomText,
    watermark,
  ]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setEnd(video.duration);
    drawComposedFrame();
  };

  // Keep the hidden <video>'s audio in sync with the "mute audio in export" toggle during preview too.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted]);

  // Wire up play/pause/time state from the hidden <video>, and redraw once whenever the user seeks.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onSeeked = () => drawComposedFrame();
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [drawComposedFrame]);

  // While playing, redraw continuously; while paused, redraw once whenever an edit changes.
  useEffect(() => {
    if (exporting) return;
    if (!isPlaying) {
      drawComposedFrame();
      return;
    }
    let raf: number;
    const loop = () => {
      drawComposedFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, exporting, drawComposedFrame]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const handlePreview = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = start;
    const onTimeUpdate = () => {
      if (video.currentTime >= end) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.play();
  };

  const handleExport = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !SUPPORTS_VIDEO_EXPORT) {
      setError("Video export isn't supported in this browser.");
      return;
    }
    if (end - start < 0.2) {
      setError("Pick a range of at least a fraction of a second.");
      return;
    }

    setExporting(true);
    setProgress(0);
    setError(null);

    try {
      drawComposedFrame();
      if (!canvas.getContext("2d"))
        throw new Error("Canvas context unavailable");

      type CaptureCanvas = HTMLCanvasElement & {
        captureStream: (fps?: number) => MediaStream;
      };
      type CaptureVideo = HTMLVideoElement & {
        captureStream?: () => MediaStream;
      };

      const canvasStream = (canvas as CaptureCanvas).captureStream(30);
      let audioTracks: MediaStreamTrack[] = [];
      if (!muted) {
        try {
          audioTracks =
            (video as CaptureVideo).captureStream?.().getAudioTracks() ?? [];
        } catch {
          // No audio track available — export video-only.
        }
      }
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);

      const mimeType =
        MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ??
        "";
      const recorder = new MediaRecorder(
        combined,
        mimeType ? { mimeType } : undefined,
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const recorded = new Promise<Blob>((resolve) => {
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      });

      video.currentTime = start;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
      });

      video.playbackRate = speed;
      recorder.start();
      await video.play();

      const step = () => {
        if (video.currentTime >= end || video.ended) {
          video.pause();
          recorder.stop();
          rafRef.current = null;
          return;
        }

        drawComposedFrame();
        setProgress(Math.min(1, (video.currentTime - start) / (end - start)));
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);

      const blob = await recorded;
      const file = new File([blob], `${item.title}-trimmed.webm`, {
        type: blob.type || "video/webm",
      });
      await onSave(file);
    } catch (err) {
      console.error("Video export failed", err);
      setError("Couldn't export that clip — see console for details.");
    } finally {
      if (video) video.playbackRate = 1;
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorTopBar
        title={item.title}
        onCancel={onCancel}
        onSave={handleExport}
        saving={exporting}
        saveLabel="Save trimmed clip"
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-neutral-200 bg-white p-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={sectionRowClass(section === s.id)}
            >
              {s.label}
            </button>
          ))}
        </aside>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-auto bg-neutral-100 p-8">
          {/* The real <video> is only a decode source now — captions, adjustments, rotate/flip/crop and the
              watermark are burned live into the visible canvas below so the preview matches the export. */}
          <video
            ref={videoRef}
            src={item.src}
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            className="pointer-events-none absolute size-px opacity-0"
            aria-hidden="true"
          />
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full rounded-lg bg-black shadow-sm ring-1 ring-black/5"
          />

          <div className="flex w-full max-w-sm items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              disabled={duration === 0}
              className={`${toolBtnClass} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon className="size-3.5" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={currentTime}
              onChange={(e) => {
                const video = videoRef.current;
                if (video) video.currentTime = Number(e.target.value);
              }}
              disabled={duration === 0}
              className="min-w-0 flex-1"
              aria-label="Seek"
            />
            <span className="w-12 shrink-0 text-right text-xs text-neutral-500">
              {formatSeconds(currentTime)}
            </span>
          </div>

          {!SUPPORTS_VIDEO_EXPORT && (
            <p className="max-w-sm rounded-md bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              This browser doesn't support client-side video export (needs
              MediaRecorder + captureStream). Try a Chromium-based browser.
            </p>
          )}
          {error && (
            <p className="max-w-sm rounded-md bg-red-50 px-3 py-2 text-center text-xs text-red-600">
              {error}
            </p>
          )}
          {exporting && (
            <div className="w-full max-w-sm">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-center text-xs text-neutral-500">
                Exporting… {Math.round(progress * 100)}%
              </p>
            </div>
          )}
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white">
          {section === "trim" && (
            <div className="flex flex-col gap-3 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
                <ScissorsIcon className="size-4 text-neutral-400" />
                Trim range
              </h3>
              <p className="text-xs text-neutral-500">
                Start {formatSeconds(start)} – End {formatSeconds(end)}
              </p>
              <SliderRow
                label="Start"
                min={0}
                max={duration}
                step={0.1}
                unit="s"
                value={start}
                onChange={(v) => setStart(Math.min(v, end - 0.1))}
              />
              <SliderRow
                label="End"
                min={0}
                max={duration}
                step={0.1}
                unit="s"
                value={end}
                onChange={(v) => setEnd(Math.max(v, start + 0.1))}
              />
              <button
                type="button"
                onClick={handlePreview}
                disabled={duration === 0}
                className={`${toolBtnClass} justify-center disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Preview range
              </button>

              <div className="mt-2">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Speed
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SPEED_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSpeed(value)}
                      className={pillBtnClass(speed === value)}
                    >
                      {value}×
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === "captions" && (
            <div className="flex flex-col gap-3 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800">
                <TextIcon className="size-4 text-neutral-400" />
                Captions
              </h3>
              <p className="text-xs text-neutral-500">
                Burned directly into the video's frames.
              </p>
              <input
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
                placeholder="Top text"
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <input
                value={bottomText}
                onChange={(e) => setBottomText(e.target.value)}
                placeholder="Bottom text"
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <SliderRow
                label="Size"
                min={16}
                max={80}
                unit="px"
                value={fontSize}
                onChange={setFontSize}
              />
            </div>
          )}

          {section === "adjustments" && (
            <div className="p-4">
              <AdjustmentsPanel
                adjustments={adjustments}
                onChange={(patch) =>
                  setAdjustments((prev) => ({ ...prev, ...patch }))
                }
                onReset={() => setAdjustments(DEFAULT_ADJUSTMENTS)}
              />
            </div>
          )}

          {section === "transform" && (
            <div className="flex flex-col gap-4 p-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Rotate / Flip
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRotation(
                        (r) => ((((r + 270) % 360) + 360) % 360) as Rotation,
                      )
                    }
                    className={toolBtnClass}
                  >
                    <RotateIcon className="size-3.5 -scale-x-100" />
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRotation((r) => ((r + 90) % 360) as Rotation)
                    }
                    className={toolBtnClass}
                  >
                    <RotateIcon className="size-3.5" />
                    Right
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipH((v) => !v)}
                    className={pillBtnClass(flipH)}
                  >
                    Flip H
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipV((v) => !v)}
                    className={pillBtnClass(flipV)}
                  >
                    Flip V
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Crop margins
                </p>
                {[
                  { label: "Top", value: cropTop, set: setCropTop },
                  { label: "Bottom", value: cropBottom, set: setCropBottom },
                  { label: "Left", value: cropLeft, set: setCropLeft },
                  { label: "Right", value: cropRight, set: setCropRight },
                ].map((row) => (
                  <SliderRow
                    key={row.label}
                    label={row.label}
                    min={0}
                    max={40}
                    unit="%"
                    value={row.value}
                    onChange={row.set}
                  />
                ))}
              </div>
            </div>
          )}

          {section === "watermark" && (
            <div className="flex flex-col gap-4 p-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Watermark
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WATERMARK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji || "none"}
                      type="button"
                      title={emoji ? undefined : "No watermark"}
                      onClick={() => setWatermark(emoji)}
                      className={`flex size-9 items-center justify-center rounded-md text-base transition ${
                        watermark === emoji
                          ? "bg-accent text-white"
                          : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      {emoji || "—"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between text-sm text-neutral-700">
                Mute audio in export
                <ToggleSwitch
                  checked={muted}
                  onChange={setMuted}
                  label="Mute audio in export"
                />
              </label>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
