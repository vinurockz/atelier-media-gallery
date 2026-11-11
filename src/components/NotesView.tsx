import { useState } from "react";
import type { MediaItem } from "@/types/media";
import type { Note } from "@/types/notes";
import type { NotePatch } from "@/lib/api/notes";
import { NoteCard } from "@/components/NoteCard";
import { NoteEditor } from "@/components/NoteEditor";
import { NoteIcon, PlusIcon } from "@/components/icons";

type Props = {
  notes: Note[];
  mediaItems: MediaItem[];
  onCreate: () => Promise<string>;
  onPatch: (id: string, patch: NotePatch) => void;
  onFlush: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Sticky-notes grid — Keep-style: pinned notes first, masonry columns so note cards can
 * be as tall as their content needs without forcing every card in a row to match. */
export function NotesView({
  notes,
  mediaItems,
  onCreate,
  onPatch,
  onFlush,
  onDelete,
}: Props) {
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  const handleCreate = async () => {
    const id = await onCreate();
    setOpenNoteId(id);
  };

  const closeEditor = () => {
    if (openNoteId) onFlush(openNoteId);
    setOpenNoteId(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this note?")) return;
    if (openNoteId === id) setOpenNoteId(null);
    onDelete(id);
  };

  const openNote = openNoteId
    ? (notes.find((n) => n.id === openNoteId) ?? null)
    : null;
  const pinned = notes.filter((n) => n.pinned);
  const others = notes.filter((n) => !n.pinned);

  const grid = (list: Note[]) => (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {list.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          mediaItems={mediaItems}
          onOpen={() => setOpenNoteId(note.id)}
          onTogglePin={() => onPatch(note.id, { pinned: !note.pinned })}
          onDelete={() => handleDelete(note.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <NoteIcon className="size-4 text-stone" />
          <h1 className="text-base font-medium text-ink">Notes</h1>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
        >
          <PlusIcon className="size-3.5" />
          New note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <NoteIcon className="size-10 text-neutral-300" />
            <p className="mt-3 text-sm text-stone">
              No notes yet. Create one to jot down text, images, or links.
            </p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="mb-6">
                <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-stone">
                  Pinned
                </div>
                {grid(pinned)}
              </div>
            )}
            {others.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-stone">
                    Others
                  </div>
                )}
                {grid(others)}
              </div>
            )}
          </>
        )}
      </div>

      {openNote && (
        <NoteEditor
          note={openNote}
          mediaItems={mediaItems}
          onPatch={(patch) => onPatch(openNote.id, patch)}
          onClose={closeEditor}
          onDelete={() => handleDelete(openNote.id)}
        />
      )}
    </div>
  );
}
