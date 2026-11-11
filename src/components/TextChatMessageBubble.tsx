import { useRef, useState, type ChangeEvent } from "react";
import type { MediaItem } from "@/types/media";
import type { TextChatMessage } from "@/types/textChat";
import { SentenceTextBlock } from "@/components/SentenceTextBlock";
import {
  CopyIcon,
  HighlighterIcon,
  ImageIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/icons";

type Props = {
  message: TextChatMessage;
  /** Alternates bubble alignment so the converted text reads like a two-side chat. */
  side: "left" | "right";
  mediaItems: MediaItem[];
  onChangeHtml: (html: string) => void;
  onToggleHighlight: () => void;
  onDelete: () => void;
  onOpenAttach: () => void;
  onUploadFiles: (files: File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => void;
};

/** Plain-text copy, stripping the bold/italic/size markup — matches what you'd expect
 * pasting a chat bubble's text elsewhere to look like. */
function plainText(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

export function TextChatMessageBubble({
  message,
  side,
  mediaItems,
  onChangeHtml,
  onToggleHighlight,
  onDelete,
  onOpenAttach,
  onUploadFiles,
  onRemoveAttachment,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(message.html));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — nothing more to do.
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onUploadFiles(files);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}
    >
      <div className="group flex max-w-[75%] flex-col gap-1.5">
        <div
          className={`rounded-2xl px-3 py-2 shadow-sm ring-1 ${
            message.highlighted
              ? "bg-yellow-100 ring-yellow-300"
              : side === "right"
                ? "bg-accent-soft ring-black/5"
                : "bg-white ring-black/5"
          }`}
        >
          <SentenceTextBlock html={message.html} onChange={onChangeHtml} />

          {message.attachments.length > 0 && (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {message.attachments.map((attachment) => {
                const item = mediaItems.find(
                  (m) => m.id === attachment.mediaItemId,
                );
                if (!item) return null;
                return (
                  <div
                    key={attachment.id}
                    className="group/media relative overflow-hidden rounded-lg ring-1 ring-black/5"
                  >
                    {item.type === "video" ? (
                      <video
                        src={item.src}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.src}
                        alt={item.title}
                        className="h-24 w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(attachment.id)}
                      aria-label="Remove attachment"
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover/media:opacity-100"
                    >
                      <TrashIcon className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 self-end opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={onToggleHighlight}
            aria-pressed={message.highlighted}
            aria-label={message.highlighted ? "Remove highlight" : "Highlight"}
            className={`flex size-6 items-center justify-center rounded-full transition hover:bg-linen-hover ${
              message.highlighted ? "text-amber-600" : "text-stone"
            }`}
          >
            <HighlighterIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenAttach}
            aria-label="Add image or video from library"
            title="Add from library"
            className="flex size-6 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover"
          >
            <ImageIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Upload image or video"
            title="Upload image or video"
            className="flex size-6 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover disabled:opacity-50"
          >
            {uploading ? (
              <SpinnerIcon className="size-3.5 animate-spin" />
            ) : (
              <UploadIcon className="size-3.5" />
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
            onClick={handleCopy}
            aria-label="Copy sentence"
            title={copied ? "Copied" : "Copy"}
            className="flex size-6 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover"
          >
            <CopyIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete sentence"
            className="flex size-6 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-red-600"
          >
            <TrashIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
