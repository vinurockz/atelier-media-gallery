import { useState } from "react";
import type { MediaItem } from "@/types/media";
import type { ChatContent } from "@/types/chat";
import type { ContentPatch } from "@/lib/api/chat";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { CloseIcon, ImageIcon } from "@/components/icons";

type Props = {
  content: ChatContent;
  mediaItems: MediaItem[];
  onSave: (patch: ContentPatch) => void;
  onClose: () => void;
};

/** Edits a content's name/description/cover image — all optional except name. Opened from
 * a content tile's edit (pencil) action in ContentGrid. */
export function ContentEditModal({
  content,
  mediaItems,
  onSave,
  onClose,
}: Props) {
  const [name, setName] = useState(content.name);
  const [description, setDescription] = useState(content.description);
  const [imageMediaItemId, setImageMediaItemId] = useState(
    content.imageMediaItemId,
  );
  const [showAttach, setShowAttach] = useState(false);

  const image = imageMediaItemId
    ? mediaItems.find((m) => m.id === imageMediaItemId)
    : null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      description: description.trim(),
      imageMediaItemId,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-linen px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Edit content</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Content name"
              className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone">
              Description <span className="text-neutral-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this content about?"
              className="w-full resize-none rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone">
              Image <span className="text-neutral-400">(optional)</span>
            </label>
            {image ? (
              <div className="relative h-28 w-full overflow-hidden rounded-md ring-1 ring-linen">
                {image.type === "video" ? (
                  <video
                    src={image.src}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={image.src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setImageMediaItemId(null)}
                  aria-label="Remove image"
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAttach(true)}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-neutral-300 text-neutral-400 transition hover:border-accent/50 hover:text-accent"
              >
                <ImageIcon className="size-4" />
                <span className="text-xs font-medium">Choose from library</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-linen px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-linen-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={handleSave}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {showAttach && (
        <AttachMediaModal
          items={mediaItems}
          multiple={false}
          typeFilter="image"
          onClose={() => setShowAttach(false)}
          onConfirm={(ids) => {
            setImageMediaItemId(ids[0] ?? null);
            setShowAttach(false);
          }}
          title="Choose a cover image"
        />
      )}
    </div>
  );
}
