import type { MediaItem } from "@/types/media";
import type { Note } from "@/types/notes";
import { FilmIcon, LinkIcon, PinIcon, TrashIcon } from "@/components/icons";

type Props = {
  note: Note;
  mediaItems: MediaItem[];
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
};

/** Strips tags for the card preview only — this is placed as text, never as HTML, so it
 * doesn't need DOMPurify. */
function textPreview(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function NoteCard({
  note,
  mediaItems,
  onOpen,
  onTogglePin,
  onDelete,
}: Props) {
  const hasContent = note.title.trim() || note.blocks.length > 0;

  return (
    <div
      className="group mb-4 break-inside-avoid overflow-hidden rounded-xl ring-1 ring-black/10 transition hover:shadow-md"
      style={{ backgroundColor: note.color }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full px-4 pt-3 text-left"
      >
        {note.title.trim() && (
          <h3 className="mb-1.5 truncate text-sm font-medium text-ink">
            {note.title}
          </h3>
        )}

        {!hasContent && <p className="pb-2 text-sm text-stone">Empty note</p>}

        <div className="space-y-2 pb-1">
          {note.blocks.slice(0, 4).map((block) => {
            if (block.type === "text") {
              const text = textPreview(block.html);
              if (!text) return null;
              return (
                <p key={block.id} className="line-clamp-6 text-sm text-ink">
                  {text}
                </p>
              );
            }
            if (block.type === "image") {
              const item = mediaItems.find((m) => m.id === block.mediaItemId);
              if (!item) return null;
              return (
                <div
                  key={block.id}
                  className="relative -mx-4 aspect-video overflow-hidden bg-black/5"
                >
                  {item.type === "video" ? (
                    <>
                      <video
                        src={item.src}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-1.5 top-1.5 flex items-center justify-center rounded-full bg-black/60 p-1 text-white">
                        <FilmIcon className="size-3" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={item.src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              );
            }
            return (
              <div
                key={block.id}
                className="flex items-center gap-1.5 truncate text-xs text-accent"
              >
                <LinkIcon className="size-3 shrink-0" />
                <span className="truncate">{block.label}</span>
              </div>
            );
          })}
        </div>
      </button>

      <div
        className={`flex items-center justify-end gap-0.5 px-2 py-1 transition group-hover:opacity-100 ${
          note.pinned ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={note.pinned}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
          className={`flex size-7 items-center justify-center rounded-full transition hover:bg-black/5 ${note.pinned ? "text-accent" : "text-neutral-500"}`}
        >
          <PinIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete note"
          className="flex size-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-black/5 hover:text-red-600"
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
