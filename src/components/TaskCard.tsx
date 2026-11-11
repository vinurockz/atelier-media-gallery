import type { KeyboardEvent, MouseEvent } from "react";
import type { MediaItem } from "@/types/media";
import type { Task } from "@/types/task";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  task: Task;
  mediaItems: MediaItem[];
  onOpen: () => void;
  onMovePrev: (() => void) | null;
  onMoveNext: (() => void) | null;
  onDelete: () => void;
  /** Flips task.completed — dims the card and strikes through its text when on. */
  onToggleCompleted: (completed: boolean) => void;
};

const iconButton =
  "flex size-6 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover";

/** Placed as text, never as HTML, so it doesn't need DOMPurify. */
function textPreview(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One task card — click anywhere (or the pencil) to edit. Draggable onto another section;
 * the arrow buttons are the click alternative for moving to the previous/next section. */
export function TaskCard({
  task,
  mediaItems,
  onOpen,
  onMovePrev,
  onMoveNext,
  onDelete,
  onToggleCompleted,
}: Props) {
  const isCompleted = task.completed ?? false;
  const firstImage = task.blocks
    .map((b) =>
      b.type === "image"
        ? mediaItems.find((m) => m.id === b.mediaItemId)
        : undefined,
    )
    .find((m): m is MediaItem => m !== undefined && m.type === "image");
  const mediaCount = task.blocks.filter((b) => b.type === "image").length;
  const linkCount = task.blocks.filter((b) => b.type === "link").length;
  const preview = task.blocks
    .map((b) => (b.type === "text" ? textPreview(b.html) : ""))
    .find((t) => t !== "");

  const stop = (handler: (() => void) | null) => (e: MouseEvent) => {
    e.stopPropagation();
    handler?.();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      aria-label={`Edit task ${task.title}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group cursor-pointer rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md ${
        isCompleted ? "opacity-60" : ""
      }`}
    >
      {firstImage && (
        <img
          src={firstImage.src}
          alt=""
          width={320}
          height={112}
          loading="lazy"
          draggable={false}
          className={`h-28 w-full rounded-t-lg object-cover ${isCompleted ? "grayscale" : ""}`}
        />
      )}
      <div className="px-3 pt-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span
            className={`text-[11px] font-medium uppercase tracking-wide ${
              isCompleted ? "text-neutral-400" : "text-stone"
            }`}
          >
            {isCompleted ? "Completed" : "Started"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isCompleted}
            aria-label={
              isCompleted ? "Mark task as started" : "Mark task as completed"
            }
            title={isCompleted ? "Mark as started" : "Mark as completed"}
            onClick={stop(() => onToggleCompleted(!isCompleted))}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
              isCompleted ? "bg-neutral-900" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block size-3.5 transform rounded-full bg-white shadow transition ${
                isCompleted ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </div>
        <p
          className={`break-words text-sm font-medium ${
            isCompleted ? "text-neutral-400 line-through" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        {preview && (
          <p
            className={`mt-1 line-clamp-2 break-words text-xs ${
              isCompleted ? "text-neutral-400 line-through" : "text-stone"
            }`}
          >
            {preview}
          </p>
        )}
        {(mediaCount > 0 || linkCount > 0) && (
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-stone">
            {mediaCount > 0 && (
              <span className="flex items-center gap-1">
                <ImageIcon className="size-3.5" />
                {mediaCount}
              </span>
            )}
            {linkCount > 0 && (
              <span className="flex items-center gap-1">
                <LinkIcon className="size-3.5" />
                {linkCount}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 px-2 pb-2 pt-1.5">
        <button
          type="button"
          onClick={stop(onMovePrev)}
          disabled={!onMovePrev}
          aria-label="Move to previous section"
          className={`${iconButton} disabled:opacity-30`}
        >
          <ChevronLeftIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={stop(onMoveNext)}
          disabled={!onMoveNext}
          aria-label="Move to next section"
          className={`${iconButton} disabled:opacity-30`}
        >
          <ChevronRightIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={stop(onOpen)}
          aria-label="Edit task"
          className={`${iconButton} ml-auto`}
        >
          <PencilIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={stop(onDelete)}
          aria-label="Delete task"
          className={`${iconButton} hover:text-red-600`}
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
