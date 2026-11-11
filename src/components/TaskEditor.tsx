import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { MediaItem } from "@/types/media";
import type { NoteBlock } from "@/types/notes";
import type { Task, TaskSection } from "@/types/task";
import type { TaskPatch } from "@/lib/api/tasks";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { NoteTextBlock } from "@/components/NoteTextBlock";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ImageIcon,
  LinkIcon,
  SpinnerIcon,
  TextIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";

type Props = {
  task: Task;
  sections: TaskSection[];
  mediaItems: MediaItem[];
  onPatch: (patch: TaskPatch) => void;
  onMove: (sectionId: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

/** Anything without a scheme gets https:// — the server only accepts http(s) links. */
function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  return /^https?:\/\//i.test(url) ? url : null;
}

const toolbarButton =
  "flex size-8 items-center justify-center rounded-full text-neutral-600 hover:bg-linen-hover";
const blockButton =
  "flex size-6 items-center justify-center rounded-full bg-white text-neutral-500 shadow ring-1 ring-black/5 disabled:opacity-30";

/** Task editor modal — title, section, and Notes-style content blocks (rich text, images or
 * videos from the library/disk, links). Every change goes through `onPatch`, which useTasks
 * debounces before saving. */
export function TaskEditor({
  task,
  sections,
  mediaItems,
  onPatch,
  onMove,
  onClose,
  onDelete,
  onImportFiles,
}: Props) {
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkError, setLinkError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // An upload resolves after the user may have typed more, so appends read the latest blocks.
  const latestBlocks = useRef(task.blocks);
  useEffect(() => {
    latestBlocks.current = task.blocks;
  }, [task.blocks]);

  const setBlocks = (blocks: NoteBlock[]) => {
    latestBlocks.current = blocks;
    onPatch({ blocks });
  };

  const addMediaBlocks = (ids: string[]) => {
    setBlocks([
      ...latestBlocks.current,
      ...ids.map((mediaItemId): NoteBlock => ({
        id: crypto.randomUUID(),
        type: "image",
        mediaItemId,
      })),
    ]);
    setShowAttach(false);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const result = await onImportFiles(files);
      addMediaBlocks(result.items.map((item) => item.id));
    } finally {
      setUploading(false);
    }
  };

  const confirmAddLink = () => {
    const url = normalizeUrl(linkUrl);
    if (!url) {
      setLinkError(true);
      return;
    }
    setBlocks([
      ...latestBlocks.current,
      {
        id: crypto.randomUUID(),
        type: "link",
        url,
        label: linkLabel.trim() || url,
      },
    ]);
    setLinkUrl("");
    setLinkLabel("");
    setLinkError(false);
    setAddingLink(false);
  };

  const updateText = (id: string, html: string) =>
    setBlocks(
      latestBlocks.current.map((b) =>
        b.id === id && b.type === "text" ? { ...b, html } : b,
      ),
    );

  const removeBlock = (id: string) =>
    setBlocks(latestBlocks.current.filter((b) => b.id !== id));

  const moveBlock = (id: string, dir: -1 | 1) => {
    const blocks = latestBlocks.current;
    const index = blocks.findIndex((b) => b.id === id);
    const target = index + dir;
    if (index === -1 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
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
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-linen px-4 py-3">
          <input
            value={task.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            placeholder="Task title"
            aria-label="Task title"
            className={`min-w-0 flex-1 text-base font-medium outline-none ${
              task.completed ? "text-neutral-400 line-through" : "text-ink"
            }`}
          />
          <select
            value={task.sectionId}
            onChange={(e) => onMove(e.target.value)}
            aria-label="Section"
            className="max-w-40 rounded-md border border-neutral-300 px-2 py-1 text-xs text-ink outline-none focus:border-accent"
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            role="switch"
            aria-checked={task.completed ?? false}
            aria-label={
              task.completed ? "Mark task as started" : "Mark task as completed"
            }
            title={task.completed ? "Completed" : "Started"}
            onClick={() => onPatch({ completed: !(task.completed ?? false) })}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
              task.completed ? "bg-neutral-900" : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block size-3.5 transform rounded-full bg-white shadow transition ${
                task.completed ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {task.blocks.length === 0 && !addingLink && (
            <p className="py-6 text-center text-sm text-stone">
              Add text, an image, or a link using the toolbar below.
            </p>
          )}

          {task.blocks.map((block, i) => (
            <div key={block.id} className="group relative">
              {block.type === "text" ? (
                <NoteTextBlock
                  html={block.html}
                  onChange={(html) => updateText(block.id, html)}
                />
              ) : block.type === "image" ? (
                <MediaBlock
                  mediaItems={mediaItems}
                  mediaItemId={block.mediaItemId}
                />
              ) : (
                <a
                  href={block.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 rounded-md bg-neutral-50 px-3 py-2 text-sm text-accent ring-1 ring-black/5 hover:underline"
                >
                  <LinkIcon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{block.label}</span>
                </a>
              )}
              <div className="absolute -right-1 -top-1 flex items-center gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, -1)}
                  disabled={i === 0}
                  aria-label="Move block up"
                  className={blockButton}
                >
                  <ChevronLeftIcon className="size-3.5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, 1)}
                  disabled={i === task.blocks.length - 1}
                  aria-label="Move block down"
                  className={blockButton}
                >
                  <ChevronRightIcon className="size-3.5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  aria-label="Remove block"
                  className={`${blockButton} text-red-500`}
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            </div>
          ))}

          {addingLink && (
            <div className="space-y-2 rounded-md bg-neutral-50 p-2.5 ring-1 ring-black/5">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkError(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && confirmAddLink()}
                placeholder="https://..."
                aria-label="Link URL"
                className="w-full rounded border border-linen px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              {linkError && (
                <p className="text-xs text-red-600">
                  Enter a valid http(s) link.
                </p>
              )}
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAddLink()}
                placeholder="Label (optional)"
                aria-label="Link label"
                className="w-full rounded border border-linen px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddingLink(false);
                    setLinkUrl("");
                    setLinkLabel("");
                    setLinkError(false);
                  }}
                  className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-linen-hover"
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

        <div className="flex items-center justify-between gap-2 border-t border-linen px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setBlocks([
                  ...latestBlocks.current,
                  { id: crypto.randomUUID(), type: "text", html: "" },
                ])
              }
              aria-label="Add text"
              title="Add text"
              className={toolbarButton}
            >
              <TextIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowAttach(true)}
              aria-label="Add from library"
              title="Add from library"
              className={toolbarButton}
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Upload image or video"
              title="Upload image or video"
              className={`${toolbarButton} disabled:opacity-50`}
            >
              {uploading ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <UploadIcon className="size-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => setAddingLink(true)}
              aria-label="Add link"
              title="Add link"
              className={toolbarButton}
            >
              <LinkIcon className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
          >
            <TrashIcon className="size-3.5" />
            Delete task
          </button>
        </div>
      </div>

      {showAttach && (
        // Blocks only render image/video (see MediaBlock below) — exclude PDFs
        // from the picker rather than let one in and render broken.
        <AttachMediaModal
          items={mediaItems.filter((m) => m.type !== "pdf")}
          onClose={() => setShowAttach(false)}
          onConfirm={addMediaBlocks}
          title="Add to task"
        />
      )}
    </div>
  );
}

function MediaBlock({
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
          controls
          playsInline
          preload="metadata"
          className="max-h-56 w-full"
        />
      ) : (
        <img
          src={item.src}
          alt={item.title}
          className="max-h-56 w-full object-cover"
        />
      )}
    </div>
  );
}
