import type { NoteBlock } from "@/types/notes";

export interface TaskSection {
  id: string;
  title: string;
  /** Raw hex, used as the section header's background. */
  color: string;
  createdAt: number;
}

export interface Task {
  id: string;
  sectionId: string;
  title: string;
  /** Same block model as Notes: rich text, library/uploaded media, and links. */
  blocks: NoteBlock[];
  /** Toggled independently of which section the task sits in. Optional — tasks saved before this field existed just won't have it; treat as false. */
  completed?: boolean;
  createdAt: number;
  updatedAt: number;
}
