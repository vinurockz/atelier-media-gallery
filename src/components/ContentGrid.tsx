import { useState } from "react";
import type { ChatContent } from "@/types/chat";
import type { MediaItem } from "@/types/media";
import type { ContentPatch } from "@/lib/api/chat";
import { ChatIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { NewFolderTile } from "@/components/NewFolderTile";
import { ContentEditModal } from "@/components/ContentEditModal";

type Props = {
  contents: ChatContent[];
  mediaItems: MediaItem[];
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
  onEdit: (id: string, patch: ContentPatch) => void;
  onDelete: (id: string) => void;
};

/** Content picker shown in the main panel when no content is open yet — mirrors the
 * Files module's category grid instead of living in the sidebar. */
export function ContentGrid({
  contents,
  mediaItems,
  onOpen,
  onCreate,
  onEdit,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingContent = editingId
    ? (contents.find((c) => c.id === editingId) ?? null)
    : null;

  const handleDelete = (id: string, name: string) => {
    if (
      window.confirm(
        `Delete "${name}"? Its users and messages will be deleted too.`,
      )
    ) {
      onDelete(id);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      {contents.length === 0 && (
        <p className="mb-4 text-sm text-stone">
          Create a content below to start a conversation.
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {contents.map((c) => {
          const image = c.imageMediaItemId
            ? mediaItems.find((m) => m.id === c.imageMediaItemId)
            : null;
          return (
            <div key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                title={c.description || c.name}
                className="relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-canvas px-2 text-center ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {image ? (
                  <div className="absolute inset-0">
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
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
                      <span className="block w-full truncate text-xs font-medium text-white">
                        {c.name}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <ChatIcon className="size-4" />
                    </span>
                    <span className="w-full truncate text-xs font-medium text-ink">
                      {c.name}
                    </span>
                  </>
                )}
              </button>

              <div className="absolute -right-1 -top-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditingId(c.id)}
                  aria-label="Edit content"
                  className="flex size-6 items-center justify-center rounded-full bg-white text-neutral-500 shadow ring-1 ring-black/5 hover:text-accent"
                >
                  <PencilIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.name)}
                  aria-label="Delete content"
                  className="flex size-6 items-center justify-center rounded-full bg-white text-red-500 shadow ring-1 ring-black/5 hover:bg-red-50"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        <NewFolderTile label="New content" onCreate={onCreate} />
      </div>

      {editingContent && (
        <ContentEditModal
          content={editingContent}
          mediaItems={mediaItems}
          onSave={(patch) => onEdit(editingContent.id, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
