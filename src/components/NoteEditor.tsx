import { useState } from "react";
import type { MediaItem } from "@/types/media";
import type { Note, NoteBlock } from "@/types/notes";
import type { NotePatch } from "@/lib/api/notes";
import { NOTE_COLOR_ORDER, NOTE_COLOR_SWATCHES } from "@/lib/noteColor";
import { NoteTextBlock } from "@/components/NoteTextBlock";
import { CustomColorSwatch } from "@/components/CustomColorSwatch";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ImageIcon,
  LinkIcon,
  PinIcon,
  TextIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  note: Note;
  mediaItems: MediaItem[];
  onPatch: (patch: NotePatch) => void;
  onClose: () => void;
  onDelete: () => void;
};

/** Full note editor — a modal over the sticky-note grid. Every change calls `onPatch`
 * immediately; the owning `useNotes` hook debounces the actual save, so this component
 * never worries about network timing. */
export function NoteEditor({
  note,
  mediaItems,
  onPatch,
  onClose,
  onDelete,
}: Props) {
  const [showAttach, setShowAttach] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const setBlocks = (blocks: NoteBlock[]) => onPatch({ blocks });

  const addTextBlock = () =>
    setBlocks([
      ...note.blocks,
      { id: crypto.randomUUID(), type: "text", html: "" },
    ]);

  const addImageBlocks = (mediaItemIds: string[]) => {
    const added: NoteBlock[] = mediaItemIds.map((mediaItemId) => ({
      id: crypto.randomUUID(),
      type: "image",
      mediaItemId,
    }));
    setBlocks([...note.blocks, ...added]);
    setShowAttach(false);
  };

  const confirmAddLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    setBlocks([
      ...note.blocks,
      {
        id: crypto.randomUUID(),
        type: "link",
        url,
        label: linkLabel.trim() || url,
      },
    ]);
    setLinkUrl("");
    setLinkLabel("");
    setAddingLink(false);
  };

  const updateBlock = (id: string, html: string) =>
    setBlocks(
      note.blocks.map((b) =>
        b.id === id && b.type === "text" ? { ...b, html } : b,
      ),
    );

  const removeBlock = (id: string) =>
    setBlocks(note.blocks.filter((b) => b.id !== id));

  const moveBlock = (id: string, dir: -1 | 1) => {
    const index = note.blocks.findIndex((b) => b.id === id);
    const target = index + dir;
    if (index === -1 || target < 0 || target >= note.blocks.length) return;
    const next = [...note.blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl shadow-xl"
        style={{ backgroundColor: note.color }}
      >
        <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
          <input
            value={note.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder="Title"
            className="min-w-0 flex-1 bg-transparent text-base font-medium text-ink outline-none placeholder:text-stone"
          />
          <button
            type="button"
            onClick={() => onPatch({ pinned: !note.pinned })}
            aria-pressed={note.pinned}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            className={`flex size-8 shrink-0 items-center justify-center rounded-full transition hover:bg-black/5 ${
              note.pinned ? "text-accent" : "text-neutral-500"
            }`}
          >
            <PinIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close note"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/5"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {note.blocks.length === 0 && !addingLink && (
            <p className="py-6 text-center text-sm text-stone">
              Empty note — add text, an image, or a link below.
            </p>
          )}

          {note.blocks.map((block, i) => (
            <div key={block.id} className="group relative">
              {block.type === "text" ? (
                <NoteTextBlock
                  html={block.html}
                  onChange={(html) => updateBlock(block.id, html)}
                />
              ) : block.type === "image" ? (
                <ImageBlockPreview
                  mediaItems={mediaItems}
                  mediaItemId={block.mediaItemId}
                />
              ) : (
                <a
                  href={block.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 rounded-md bg-white/70 px-3 py-2 text-sm text-accent ring-1 ring-black/5 hover:underline"
                >
                  <LinkIcon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{block.label}</span>
                </a>
              )}

              <div className="absolute -right-1 -top-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, -1)}
                  disabled={i === 0}
                  aria-label="Move block up"
                  className="flex size-6 items-center justify-center rounded-full bg-white text-neutral-500 shadow ring-1 ring-black/5 disabled:opacity-30"
                >
                  <ChevronLeftIcon className="size-3.5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, 1)}
                  disabled={i === note.blocks.length - 1}
                  aria-label="Move block down"
                  className="flex size-6 items-center justify-center rounded-full bg-white text-neutral-500 shadow ring-1 ring-black/5 disabled:opacity-30"
                >
                  <ChevronRightIcon className="size-3.5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  aria-label="Remove block"
                  className="flex size-6 items-center justify-center rounded-full bg-white text-red-500 shadow ring-1 ring-black/5"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            </div>
          ))}

          {addingLink && (
            <div className="space-y-2 rounded-md bg-white/70 p-2.5 ring-1 ring-black/5">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAddLink()}
                placeholder="https://..."
                className="w-full rounded border border-linen px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAddLink()}
                placeholder="Label (optional)"
                className="w-full rounded border border-linen px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddingLink(false);
                    setLinkUrl("");
                    setLinkLabel("");
                  }}
                  className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmAddLink}
                  className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
                >
                  Add link
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-black/10 px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={addTextBlock}
              aria-label="Add text"
              className="flex size-8 items-center justify-center rounded-full text-neutral-600 hover:bg-black/5"
            >
              <TextIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowAttach(true)}
              aria-label="Add image"
              className="flex size-8 items-center justify-center rounded-full text-neutral-600 hover:bg-black/5"
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setAddingLink(true)}
              aria-label="Add link"
              className="flex size-8 items-center justify-center rounded-full text-neutral-600 hover:bg-black/5"
            >
              <LinkIcon className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {NOTE_COLOR_ORDER.map((color) => {
              const hex = NOTE_COLOR_SWATCHES[color];
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onPatch({ color: hex })}
                  aria-label={`${color} note`}
                  aria-pressed={note.color === hex}
                  className={`size-5 rounded-full ring-1 ring-black/10 transition ${
                    note.color === hex ? "ring-2 ring-accent" : ""
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
            <CustomColorSwatch onChange={(color) => onPatch({ color })} />
          </div>

          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete note"
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 hover:text-red-600"
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>

      {showAttach && (
        <AttachMediaModal
          items={mediaItems}
          typeFilter="image"
          onClose={() => setShowAttach(false)}
          onConfirm={addImageBlocks}
          title="Add image to note"
        />
      )}
    </div>
  );
}

function ImageBlockPreview({
  mediaItems,
  mediaItemId,
}: {
  mediaItems: MediaItem[];
  mediaItemId: string;
}) {
  const item = mediaItems.find((m) => m.id === mediaItemId);
  if (!item) return null;
  return (
    <div className="overflow-hidden rounded-md ring-1 ring-black/5">
      {item.type === "video" ? (
        <video
          src={item.src}
          muted
          playsInline
          preload="metadata"
          className="max-h-56 w-full object-cover"
        />
      ) : (
        <img src={item.src} alt="" className="max-h-56 w-full object-cover" />
      )}
    </div>
  );
}
