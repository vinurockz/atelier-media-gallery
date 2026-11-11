import type { EditorSession } from "@/types/editorSession";
import type { MediaItem } from "@/types/media";
import { FilmIcon, ImageIcon, PlusIcon, TrashIcon } from "@/components/icons";

type Props = {
  title: string;
  mediaType: "image" | "video";
  sessions: EditorSession[];
  mediaItems: MediaItem[];
  onNew: () => void;
  onResume: (session: EditorSession) => void;
  onDelete: (id: string) => void;
};

/** One "Images" or "Videos" block on the Editor landing page — its history of draft
 * (in-progress) and completed edit sessions, each deletable. */
export function EditorSessionBlock({
  title,
  mediaType,
  sessions,
  mediaItems,
  onNew,
  onResume,
  onDelete,
}: Props) {
  const Icon = mediaType === "image" ? ImageIcon : FilmIcon;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="size-4 text-neutral-400" />
          {title}
          <span className="text-xs font-normal text-neutral-400">
            {sessions.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
        >
          <PlusIcon className="size-3.5" />
          New {mediaType === "image" ? "picture" : "video"} edit
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 py-6 text-center text-sm text-neutral-400">
          No {title.toLowerCase()} edits yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {sessions.map((session) => {
            const sourceItem = mediaItems.find(
              (m) => m.id === session.sourceItemId,
            );
            const previewItem =
              session.status === "completed"
                ? (mediaItems.find((m) => m.id === session.resultItemId) ??
                  sourceItem)
                : sourceItem;

            if (!sourceItem) {
              return (
                <div key={session.id} className="group relative">
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg bg-canvas px-2 text-center ring-1 ring-black/5">
                    <Icon className="size-5 text-neutral-300" />
                    <span className="text-[10px] text-neutral-400">
                      Source removed
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(session.id)}
                    aria-label="Remove from history"
                    className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div key={session.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onResume(session)}
                  title={
                    session.status === "draft" ? "Resume editing" : "Edit again"
                  }
                  className="flex aspect-square w-full flex-col overflow-hidden rounded-lg bg-canvas text-left ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative flex-1 overflow-hidden bg-neutral-200">
                    {previewItem?.type === "video" ? (
                      <video
                        src={previewItem.src}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : previewItem ? (
                      <img
                        src={previewItem.src}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <span
                      className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white ${
                        session.status === "draft"
                          ? "bg-amber-500"
                          : "bg-emerald-600"
                      }`}
                    >
                      {session.status === "draft" ? "Draft" : "Done"}
                    </span>
                  </div>
                  <span className="truncate px-2 py-1.5 text-xs font-medium text-ink">
                    {sourceItem.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(session.id)}
                  aria-label="Delete from history"
                  className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-white text-red-500 opacity-0 shadow ring-1 ring-black/5 transition hover:bg-red-50 group-hover:opacity-100"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
