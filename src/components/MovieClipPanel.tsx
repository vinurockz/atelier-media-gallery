import { useState } from "react";
import type {
  ClipKind,
  ClipObject,
  DialogueBubble,
  IdleAnimationType,
  MovieClip,
  TransitionType,
} from "@/types/movie";
import type { MediaItem } from "@/types/media";
import { SliderRow } from "@/components/SliderRow";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  ChatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  FilmIcon,
  ImageIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

interface Props {
  clip: MovieClip;
  mediaItems: MediaItem[];
  /** The source video's own duration, once probed, keyed by mediaItemId — bounds the trim slider. */
  knownVideoDurations: Record<string, number>;
  onChange: (patch: Partial<MovieClip>) => void;
  onDelete: () => void;
  onAddObject: () => void;
  /** Opens the object's current image in the full Image Editor — image objects only. */
  onEditImage: (objectId: string) => void;
  /** Swaps which file an object uses, keeping its position/size/animation. */
  onReplaceObject: (objectId: string, kind: ClipKind) => void;
}

const IDLE_OPTIONS: { value: IdleAnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "kenburns-in", label: "Zoom in" },
  { value: "kenburns-out", label: "Zoom out" },
  { value: "shake", label: "Shake" },
  { value: "tilt3d", label: "3D tilt" },
];

export const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "none", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "slide-left", label: "Slide from left" },
  { value: "slide-right", label: "Slide from right" },
  { value: "slide-up", label: "Slide from top" },
  { value: "slide-down", label: "Slide from bottom" },
  { value: "zoom", label: "Zoom" },
];

const toggleClass = (active: boolean) =>
  `rounded-md px-2 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-neutral-900 text-white"
      : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
  }`;

const selectClass =
  "w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-800 outline-none focus:border-accent";

function newDialogue(duration: number): DialogueBubble {
  return {
    id: crypto.randomUUID(),
    text: "Say something...",
    startSec: 0,
    endSec: Math.min(duration, 2),
    attachedObjectId: null,
    x: 0.5,
    y: 0.5,
    bubbleColor: "#ffffff",
    textColor: "#111827",
    fontSize: 40,
    fontFamily: "sans-serif",
  };
}

// Same list as BandPropertiesPanel's header/footer font picker, for consistency.
const DIALOGUE_FONTS: { label: string; value: string }[] = [
  { label: "Sans", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "monospace" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Script", value: "cursive" },
];

/**
 * Right-panel settings for a selected clip (scene): its whole-scene entrance/exit, every
 * object placed in it (position/size, trim/mute, idle animation — the "crop zoom"/"shake"/
 * "3D" effects, and its own visible window), and the clip's dialogue bubbles — each either
 * freely positioned or anchored above a specific object, for a "conversation between them".
 */
export function MovieClipPanel({
  clip,
  mediaItems,
  knownVideoDurations,
  onChange,
  onDelete,
  onAddObject,
  onEditImage,
  onReplaceObject,
}: Props) {
  const [expandedObjectId, setExpandedObjectId] = useState<string | null>(
    clip.objects[0]?.id ?? null,
  );

  const getMediaItem = (id: string) =>
    mediaItems.find((m) => m.id === id) ?? null;

  const patchObject = (id: string, patch: Partial<ClipObject>) => {
    onChange({
      objects: clip.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };
  const removeObject = (id: string) => {
    onChange({ objects: clip.objects.filter((o) => o.id !== id) });
    onChange({
      dialogues: clip.dialogues.map((d) =>
        d.attachedObjectId === id ? { ...d, attachedObjectId: null } : d,
      ),
    });
  };

  const patchDialogue = (id: string, patch: Partial<DialogueBubble>) => {
    onChange({
      dialogues: clip.dialogues.map((d) =>
        d.id === id ? { ...d, ...patch } : d,
      ),
    });
  };
  const removeDialogue = (id: string) => {
    onChange({ dialogues: clip.dialogues.filter((d) => d.id !== id) });
  };
  const addDialogue = () => {
    onChange({ dialogues: [...clip.dialogues, newDialogue(clip.duration)] });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Scene</h3>
        <button
          type="button"
          onClick={onDelete}
          title="Remove clip"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>

      <SliderRow
        label="Duration"
        min={0.5}
        max={600}
        step={0.1}
        unit="s"
        value={clip.duration}
        onChange={(v) => onChange({ duration: v })}
      />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Scene transition
        </p>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          In (entrance)
          <select
            value={clip.transitionIn}
            onChange={(e) =>
              onChange({ transitionIn: e.target.value as TransitionType })
            }
            className={selectClass}
          >
            {TRANSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Out (exit)
          <select
            value={clip.transitionOut}
            onChange={(e) =>
              onChange({ transitionOut: e.target.value as TransitionType })
            }
            className={selectClass}
          >
            {TRANSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Objects in this scene
          </p>
          <button
            type="button"
            onClick={onAddObject}
            title="Add an object to this scene"
            className="flex size-6 items-center justify-center rounded-full text-accent transition hover:bg-linen-hover"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        {clip.objects.length === 0 && (
          <p className="text-xs text-neutral-400">
            Empty scene — add a video or image to put something on screen.
          </p>
        )}
        {clip.objects.map((obj) => {
          const item = getMediaItem(obj.mediaItemId);
          const expanded = expandedObjectId === obj.id;
          const knownDuration =
            obj.kind === "video"
              ? (knownVideoDurations[obj.mediaItemId] ?? null)
              : null;
          return (
            <div
              key={obj.id}
              className="flex flex-col gap-2 rounded-md bg-neutral-50 p-2 ring-1 ring-black/5"
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setExpandedObjectId(expanded ? null : obj.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  {obj.kind === "video" ? (
                    <FilmIcon className="size-3.5 shrink-0 text-neutral-400" />
                  ) : (
                    <ImageIcon className="size-3.5 shrink-0 text-neutral-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-800">
                    {item?.title ?? "Object"}
                  </span>
                  {expanded ? (
                    <ChevronLeftIcon className="size-3 shrink-0 -rotate-90 text-neutral-400" />
                  ) : (
                    <ChevronRightIcon className="size-3 shrink-0 -rotate-90 text-neutral-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeObject(obj.id)}
                  title="Remove object"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="size-3" />
                </button>
              </div>

              {expanded && (
                <div className="flex flex-col gap-2 border-t border-neutral-200 pt-2">
                  <div className="flex gap-1.5">
                    {obj.kind === "image" && (
                      <button
                        type="button"
                        onClick={() => onEditImage(obj.id)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                      >
                        <PencilIcon className="size-3.5" />
                        Edit image
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onReplaceObject(obj.id, obj.kind)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                    >
                      <PlusIcon className="size-3.5" />
                      Replace
                    </button>
                  </div>
                  <SliderRow
                    label="X"
                    min={0}
                    max={100}
                    unit="%"
                    value={Math.round(obj.x * 100)}
                    onChange={(v) => patchObject(obj.id, { x: v / 100 })}
                  />
                  <SliderRow
                    label="Y"
                    min={0}
                    max={100}
                    unit="%"
                    value={Math.round(obj.y * 100)}
                    onChange={(v) => patchObject(obj.id, { y: v / 100 })}
                  />
                  <SliderRow
                    label="Width"
                    min={5}
                    max={100}
                    unit="%"
                    value={Math.round(obj.width * 100)}
                    onChange={(v) => patchObject(obj.id, { width: v / 100 })}
                  />
                  <SliderRow
                    label="Appears"
                    min={0}
                    max={Math.max(0.1, clip.duration - 0.1)}
                    step={0.1}
                    unit="s"
                    value={Math.min(obj.startSec, clip.duration)}
                    onChange={(v) => patchObject(obj.id, { startSec: v })}
                  />
                  <SliderRow
                    label="Leaves"
                    min={0.1}
                    max={clip.duration}
                    step={0.1}
                    unit="s"
                    value={Math.min(obj.endSec, clip.duration)}
                    onChange={(v) => patchObject(obj.id, { endSec: v })}
                  />
                  {obj.kind === "video" && (
                    <>
                      <SliderRow
                        label="Trim start"
                        min={0}
                        max={
                          knownDuration ? Math.max(0, knownDuration - 0.5) : 0
                        }
                        step={0.1}
                        unit="s"
                        value={obj.trimStart}
                        onChange={(v) => patchObject(obj.id, { trimStart: v })}
                      />
                      <label className="flex items-center justify-between text-xs text-neutral-500">
                        Play its own audio
                        <ToggleSwitch
                          checked={!obj.muted}
                          onChange={(checked) =>
                            patchObject(obj.id, { muted: !checked })
                          }
                          label="Play object audio"
                        />
                      </label>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {IDLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          patchObject(obj.id, {
                            idleAnimation: {
                              ...obj.idleAnimation,
                              type: opt.value,
                            },
                          })
                        }
                        className={toggleClass(
                          obj.idleAnimation.type === opt.value,
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {obj.idleAnimation.type !== "none" && (
                    <SliderRow
                      label="Strength"
                      min={1}
                      max={100}
                      unit="%"
                      value={obj.idleAnimation.intensity}
                      onChange={(v) =>
                        patchObject(obj.id, {
                          idleAnimation: { ...obj.idleAnimation, intensity: v },
                        })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            <ChatIcon className="size-3.5" />
            Dialogue
          </p>
          <button
            type="button"
            onClick={addDialogue}
            title="Add dialogue bubble"
            className="flex size-6 items-center justify-center rounded-full text-accent transition hover:bg-linen-hover"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
        {clip.dialogues.length === 0 && (
          <p className="text-xs text-neutral-400">
            No dialogue on this clip yet.
          </p>
        )}
        {clip.dialogues.map((d) => (
          <div
            key={d.id}
            className="flex flex-col gap-2 rounded-md bg-neutral-50 p-2.5 ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between gap-1">
              <textarea
                value={d.text}
                onChange={(e) => patchDialogue(d.id, { text: e.target.value })}
                rows={2}
                className="w-full resize-none rounded border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => removeDialogue(d.id)}
                title="Remove dialogue"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </div>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Speaker (positions the bubble above them)
              <select
                value={d.attachedObjectId ?? ""}
                onChange={(e) =>
                  patchDialogue(d.id, {
                    attachedObjectId: e.target.value || null,
                  })
                }
                className={selectClass}
              >
                <option value="">Free position</option>
                {clip.objects.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {getMediaItem(obj.mediaItemId)?.title ?? "Object"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  patchDialogue(d.id, {
                    attachedObjectId: null,
                    x: 0.5,
                    y: 0.08,
                  })
                }
                className="flex-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
              >
                Pin to top
              </button>
              <button
                type="button"
                onClick={() =>
                  patchDialogue(d.id, {
                    attachedObjectId: null,
                    x: 0.5,
                    y: 0.92,
                  })
                }
                className="flex-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
              >
                Pin to bottom
              </button>
            </div>
            <label className="flex items-center justify-between text-xs text-neutral-500">
              Style
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => patchDialogue(d.id, { style: "bubble" })}
                  className={toggleClass((d.style ?? "bubble") === "bubble")}
                >
                  Speech bubble
                </button>
                <button
                  type="button"
                  onClick={() => patchDialogue(d.id, { style: "caption" })}
                  className={toggleClass(d.style === "caption")}
                >
                  Plain caption
                </button>
              </div>
            </label>
            <SliderRow
              label="Appears"
              min={0}
              max={Math.max(0.1, clip.duration - 0.1)}
              step={0.1}
              unit="s"
              value={Math.min(d.startSec, clip.duration)}
              onChange={(v) => patchDialogue(d.id, { startSec: v })}
            />
            <SliderRow
              label="Hides"
              min={0.1}
              max={clip.duration}
              step={0.1}
              unit="s"
              value={Math.min(d.endSec, clip.duration)}
              onChange={(v) => patchDialogue(d.id, { endSec: v })}
            />
            <SliderRow
              label="Text size"
              min={12}
              max={120}
              unit="px"
              value={d.fontSize}
              onChange={(v) => patchDialogue(d.id, { fontSize: v })}
            />
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Font
              <select
                value={d.fontFamily}
                onChange={(e) =>
                  patchDialogue(d.id, { fontFamily: e.target.value })
                }
                className={selectClass}
              >
                {DIALOGUE_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            {!d.attachedObjectId && (
              <>
                <SliderRow
                  label="X"
                  min={0}
                  max={100}
                  unit="%"
                  value={Math.round(d.x * 100)}
                  onChange={(v) => patchDialogue(d.id, { x: v / 100 })}
                />
                <SliderRow
                  label="Y"
                  min={0}
                  max={100}
                  unit="%"
                  value={Math.round(d.y * 100)}
                  onChange={(v) => patchDialogue(d.id, { y: v / 100 })}
                />
              </>
            )}
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <label className="flex items-center gap-1.5">
                Bubble
                <input
                  type="color"
                  value={d.bubbleColor}
                  onChange={(e) =>
                    patchDialogue(d.id, { bubbleColor: e.target.value })
                  }
                  className="size-6 cursor-pointer rounded border border-neutral-300"
                />
              </label>
              <label className="flex items-center gap-1.5">
                Text
                <input
                  type="color"
                  value={d.textColor}
                  onChange={(e) =>
                    patchDialogue(d.id, { textColor: e.target.value })
                  }
                  className="size-6 cursor-pointer rounded border border-neutral-300"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    dialogues: [
                      ...clip.dialogues,
                      { ...d, id: crypto.randomUUID() },
                    ],
                  })
                }
                title="Duplicate"
                className="ml-auto flex size-6 items-center justify-center rounded-full text-neutral-400 hover:bg-linen-hover hover:text-neutral-700"
              >
                <CopyIcon className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
