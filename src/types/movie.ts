import type { EditorBand } from "@/types/editor";

export type ClipKind = "video" | "image";

export type MovieAspect = "16:9" | "9:16" | "1:1" | "4:3";

/** Pixel size for each supported aspect, at a fixed export resolution. */
export const ASPECT_SIZES: Record<
  MovieAspect,
  { width: number; height: number }
> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 960, height: 960 },
  "4:3": { width: 1024, height: 768 },
};

export type IdleAnimationType =
  "none" | "kenburns-in" | "kenburns-out" | "shake" | "tilt3d";

/** Plays continuously while the object is visible — the "crop zoom"/"shake"/"3D" effects. */
export interface IdleAnimation {
  type: IdleAnimationType;
  /** 0-100. Meaning depends on type: kenburns = how far it zooms, shake = jitter strength, tilt3d = max tilt angle. */
  intensity: number;
}

export type TransitionType =
  | "none"
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom";

/**
 * One positioned video/image inside a clip — a clip is a scene that can hold several of
 * these side by side (two characters in frame, etc.), each independently placed, sized,
 * timed, and animated. A clip with exactly one full-size object is just the simple
 * one-thing-on-screen case.
 */
export interface ClipObject {
  id: string;
  kind: ClipKind;
  mediaItemId: string;
  /** 0-1, relative to the canvas's content area (between header/footer) — center position. */
  x: number;
  y: number;
  /** 0-1 of the content area's width. Height follows the media's own aspect ratio. */
  width: number;
  /** Video only: where in the source file playback starts, seconds. */
  trimStart: number;
  /** Video only: whether its own audio plays during export. */
  muted: boolean;
  idleAnimation: IdleAnimation;
  /** Seconds into the clip this object is visible for — lets objects enter/leave independently (defaults to the whole clip). */
  startSec: number;
  endSec: number;
}

/** A chat-bubble line of dialogue, timed within its clip's own local timeline (not the movie's). */
export interface DialogueBubble {
  id: string;
  text: string;
  /** Seconds into the clip. */
  startSec: number;
  endSec: number;
  /** Anchors the bubble just above this object instead of a fixed spot — the "conversation
   * between them" case: give each speaker's line its own bubble attached to its object. */
  attachedObjectId: string | null;
  /** 0-1, relative to the content area. Used when attachedObjectId is null (free placement). */
  x: number;
  y: number;
  bubbleColor: string;
  textColor: string;
  /** px, at the canvas's native (export) resolution. */
  fontSize: number;
  /** CSS font-family value — canvas text rendering already supports any language/script the
   * typed text uses (the browser substitutes a fallback font for glyphs this family lacks),
   * so this is purely a style choice, not a language setting. */
  fontFamily: string;
  /** "bubble" (default, a rounded box with a little speech-bubble tail) or "caption" (a plain
   * rounded box, no tail — the Slideshow module's style for top/bottom text overlays). Optional
   * — a dialogue saved before this field existed just renders as "bubble". */
  style?: "bubble" | "caption";
}

export interface MovieClip {
  id: string;
  /** Seconds this clip (scene) is on screen. */
  duration: number;
  /** Whole-scene entrance/exit — applies to everything in the clip together, not per object. */
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  objects: ClipObject[];
  dialogues: DialogueBubble[];
}

export interface Movie {
  id: string;
  title: string;
  clips: MovieClip[];
  aspect: MovieAspect;
  background: string;
  header: EditorBand;
  footer: EditorBand;
  createdAt: number;
  updatedAt: number;
}
