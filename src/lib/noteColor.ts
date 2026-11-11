import type { NoteColor } from "@/types/notes";

/** Sticky-note background per color — pastel, so dark text stays readable on every one. */
export const NOTE_COLOR_SWATCHES: Record<NoteColor, string> = {
  default: "#ffffff",
  red: "#f6c9c6",
  orange: "#fde3cc",
  yellow: "#fbf1b7",
  green: "#d7edc9",
  teal: "#c9eded",
  blue: "#cfe4fb",
  purple: "#e5d4f2",
  pink: "#f6d3e4",
};

export const NOTE_COLOR_ORDER: NoteColor[] = [
  "default",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
];
