/** Sticky-note color swatches — pastel, Keep-style (distinct from the file-manager's COLOR_SWATCHES). */
export type NoteColor =
  | "default"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

export type NoteBlock =
  | { id: string; type: "text"; html: string }
  | { id: string; type: "image"; mediaItemId: string }
  | { id: string; type: "link"; url: string; label: string };

export interface Note {
  id: string;
  title: string;
  /** A hex value — either one of NOTE_COLOR_SWATCHES' presets or a custom color picked via
   * CustomColorSwatch, so this is `string`, not the closed `NoteColor` preset-key union. */
  color: string;
  pinned: boolean;
  blocks: NoteBlock[];
  createdAt: number;
  updatedAt: number;
}
