import { useRef, useState, type ChangeEvent } from "react";
import type { CategorySummary } from "@/hooks/useOrganization";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import type { MediaItem } from "@/types/media";
import type { MovieAspect, MovieClip, TransitionType } from "@/types/movie";
import { TRANSITION_OPTIONS } from "@/components/MovieClipPanel";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import {
  CloseIcon,
  FilmIcon,
  ImageIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";

type Props = {
  categories: CategorySummary[];
  mediaItems: MediaItem[];
  onClose: () => void;
  onCreate: (
    title: string,
    aspect: MovieAspect,
    clips: MovieClip[],
  ) => Promise<void>;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

const ASPECTS: MovieAspect[] = ["16:9", "9:16", "1:1", "4:3"];

function slideClip(
  item: MediaItem,
  duration: number,
  style: TransitionType,
): MovieClip {
  return {
    id: crypto.randomUUID(),
    duration,
    transitionIn: style,
    transitionOut: style,
    objects: [
      {
        id: crypto.randomUUID(),
        kind: item.type === "video" ? "video" : "image",
        mediaItemId: item.id,
        x: 0.5,
        y: 0.5,
        // Fills the frame — a slide's image/video is its own full background, with an
        // optional caption (added afterward in the workspace) layered on top.
        width: 1,
        trimStart: 0,
        muted: false,
        idleAnimation: { type: "none", intensity: 30 },
        startSec: 0,
        endSec: 1e6,
      },
    ],
    dialogues: [],
  };
}

/**
 * The guided way to start a slideshow: pick a whole category's worth of images/videos
 * (and/or add more individually, and/or upload fresh files), choose one transition style and
 * a default seconds-per-slide, and this builds the full clips array in one shot — one clip
 * per item, each filling the frame. The result is a perfectly ordinary Movie-shaped
 * slideshow, so everything past this point (reordering, per-slide duration/trim, captions,
 * export) happens in the same MovieWorkspace the Movies module already uses.
 */
export function NewSlideshowModal({
  categories,
  mediaItems,
  onClose,
  onCreate,
  onImportFiles,
}: Props) {
  const [title, setTitle] = useState("");
  const [aspect, setAspect] = useState<MovieAspect>("16:9");
  const [style, setStyle] = useState<TransitionType>("fade");
  const [seconds, setSeconds] = useState(4);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [categoryKey, setCategoryKey] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addItems = (newItems: MediaItem[]) => {
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...newItems.filter((i) => !seen.has(i.id))];
    });
  };

  const addFromCategory = () => {
    if (!categoryKey) return;
    addItems(mediaItems.filter((i) => i.category === categoryKey));
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const result = await onImportFiles(files);
      addItems(result.items);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one image or video first");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const clips = items.map((item) => slideClip(item, seconds, style));
      await onCreate(trimmed, aspect, clips);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't create this slideshow",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-linen bg-surface shadow-lifted">
        <div className="flex items-center justify-between border-b border-linen px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">New slideshow</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full text-stone transition-colors hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Slideshow name"
            aria-label="Slideshow name"
            className="w-full rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
              Add slides
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryKey}
                onChange={(e) => setCategoryKey(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-linen px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
              >
                <option value="">Pick a category…</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addFromCategory}
                disabled={!categoryKey}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add all
              </button>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 rounded-md border border-linen px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-linen-hover"
              >
                <ImageIcon className="size-3.5" />
                Pick files
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-md border border-linen px-2.5 py-1.5 text-xs font-medium text-ink transition hover:bg-linen-hover disabled:opacity-50"
              >
                {uploading ? (
                  <SpinnerIcon className="size-3.5 animate-spin" />
                ) : (
                  <UploadIcon className="size-3.5" />
                )}
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => void handleUpload(e)}
                className="hidden"
              />
            </div>
          </div>

          {items.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square overflow-hidden rounded-md bg-linen ring-1 ring-black/5"
                >
                  {item.type === "video" ? (
                    <video
                      src={item.src}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={item.src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  {item.type === "video" && (
                    <span className="absolute left-1 top-1 flex items-center justify-center rounded-full bg-ink/65 p-0.5 text-surface">
                      <FilmIcon className="size-2.5" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove"
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <TrashIcon className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
              Style
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {TRANSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStyle(opt.value)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    style === opt.value
                      ? "bg-accent text-white"
                      : "bg-white text-ink ring-1 ring-linen hover:bg-linen-hover"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex flex-1 items-center justify-between gap-2 text-xs text-stone">
              Seconds per slide
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value) || 1)}
                className="w-20 rounded-md border border-linen px-2 py-1 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-1 items-center justify-between gap-2 text-xs text-stone">
              Aspect
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value as MovieAspect)}
                className="rounded-md border border-linen px-2 py-1 text-sm text-ink outline-none focus:border-accent"
              >
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-linen px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-stone transition-colors hover:bg-linen-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={creating}
            onClick={() => void submit()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating…" : `Create (${items.length} slides)`}
          </button>
        </div>
      </div>

      {showPicker && (
        <AttachMediaModal
          items={mediaItems.filter((m) => m.type !== "pdf")}
          onClose={() => setShowPicker(false)}
          onConfirm={(ids) => {
            addItems(
              ids
                .map((id) => mediaItems.find((m) => m.id === id))
                .filter((m): m is MediaItem => m !== undefined),
            );
            setShowPicker(false);
          }}
          title="Pick slides from your library"
        />
      )}
    </div>
  );
}
