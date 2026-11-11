import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { ChatContent, ChatMessage, ChatUser } from "@/types/chat";
import type { MediaItem } from "@/types/media";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import type { ContentPatch } from "@/lib/api/chat";
import { formatTime } from "@/lib/formatDate";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { ContentGrid } from "@/components/ContentGrid";
import { MediaLightbox } from "@/components/MediaLightbox";
import {
  AttachIcon,
  ChevronLeftIcon,
  CloseIcon,
  DownloadIcon,
  ImageIcon,
  PencilIcon,
  SendIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/icons";

interface ChatViewProps {
  contentName: string | null;
  contents: ChatContent[];
  onSelectContent: (id: string) => void;
  onCreateContent: (name: string) => void;
  onEditContent: (id: string, patch: ContentPatch) => void;
  onDeleteContent: (id: string) => void;
  onBackToContents: () => void;
  users: ChatUser[];
  activeUserId: string | null;
  messages: ChatMessage[];
  mediaItems: MediaItem[];
  onSend: (text: string, attachmentIds: string[]) => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
  onEditMessage: (
    messageId: string,
    text: string,
    attachmentIds: string[],
  ) => void;
  onDeleteMessage: (messageId: string) => void;
  onExportPdf: () => void;
}

/** One content's conversation — send as whichever user is active in the sidebar for it. */
export function ChatView({
  contentName,
  contents,
  onSelectContent,
  onCreateContent,
  onEditContent,
  onDeleteContent,
  onBackToContents,
  users,
  activeUserId,
  messages,
  mediaItems,
  onSend,
  onImportFiles,
  onEditMessage,
  onDeleteMessage,
  onExportPdf,
}: ChatViewProps) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editAttachmentIds, setEditAttachmentIds] = useState<string[]>([]);
  const [editShowPicker, setEditShowPicker] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const activeUser = users.find((u) => u.id === activeUserId) ?? null;
  // Attachments are image/video only — same restriction the direct-upload
  // input already enforces (accept="image/*,video/*"); a PDF picked from the
  // library here would otherwise break MediaLightbox, which doesn't know
  // how to render one.
  const attachableMediaItems = mediaItems.filter((m) => m.type !== "pdf");

  if (!contentName) {
    return (
      <ContentGrid
        contents={contents}
        mediaItems={mediaItems}
        onOpen={onSelectContent}
        onCreate={onCreateContent}
        onEdit={onEditContent}
        onDelete={onDeleteContent}
      />
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-neutral-600">No users yet.</p>
        <p className="mt-1 text-xs text-neutral-400">
          Add one from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  if (!activeUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-neutral-600">
          Pick a user from the sidebar.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          You'll send messages as whoever's selected.
        </p>
      </div>
    );
  }

  const handleSend = () => {
    if (!text.trim() && pending.length === 0) return;
    onSend(text, pending);
    setText("");
    setPending([]);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      const result = await onImportFiles(files);
      setPending((prev) => [...prev, ...result.items.map((item) => item.id)]);
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (message: ChatMessage) => {
    setEditingId(message.id);
    setEditText(message.text);
    setEditAttachmentIds(message.attachmentIds);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
    setEditAttachmentIds([]);
  };

  const saveEdit = () => {
    if (!editingId || (!editText.trim() && editAttachmentIds.length === 0))
      return;
    onEditMessage(editingId, editText, editAttachmentIds);
    cancelEdit();
  };

  const handleDelete = (messageId: string) => {
    if (window.confirm("Delete this message?")) onDeleteMessage(messageId);
  };

  const handleEditUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setEditUploading(true);
    try {
      const result = await onImportFiles(files);
      setEditAttachmentIds((prev) => [
        ...prev,
        ...result.items.map((item) => item.id),
      ]);
    } finally {
      setEditUploading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-linen px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBackToContents}
            title="Back to contents"
            aria-label="Back to contents"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-ink"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <h2 className="truncate text-sm font-medium text-ink">
            {contentName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onExportPdf}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover hover:text-ink"
        >
          <DownloadIcon className="size-3.5" />
          Export PDF
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-400">
            No messages yet — say something as {activeUser.name}.
          </p>
        )}
        {messages.map((message) => {
          const sender = users.find((u) => u.id === message.userId);
          const isSelf = message.userId === activeUserId;
          const isEditing = editingId === message.id;
          return (
            <div
              key={message.id}
              className={`group mb-3 flex items-end gap-2 ${isSelf ? "flex-row-reverse" : ""}`}
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: sender?.color ?? "#9ca3af" }}
                title={sender?.name ?? "Unknown"}
              >
                {sender?.name.slice(0, 1).toUpperCase() ?? "?"}
              </span>

              {isEditing ? (
                <div className="w-full max-w-sm rounded-2xl bg-white px-3.5 py-2.5 text-sm ring-2 ring-accent">
                  {editAttachmentIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {editAttachmentIds.map((id) => {
                        const item = mediaItems.find((i) => i.id === id);
                        if (!item) return null;
                        return (
                          <div
                            key={id}
                            className="relative size-12 overflow-hidden rounded-md bg-neutral-200 ring-1 ring-linen"
                          >
                            {item.type === "video" ? (
                              <video
                                src={item.src}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <img
                                src={item.src}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setEditAttachmentIds((prev) =>
                                  prev.filter((p) => p !== id),
                                )
                              }
                              className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white"
                            >
                              <CloseIcon className="size-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                      }
                      if (e.key === "Escape") cancelEdit();
                    }}
                    rows={2}
                    autoFocus
                    className="w-full resize-none rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditShowPicker(true)}
                        title="Attach from your library"
                        className="flex size-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover"
                      >
                        <ImageIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={editUploading}
                        title="Upload from your device"
                        className="flex size-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover disabled:opacity-50"
                      >
                        {editUploading ? (
                          <SpinnerIcon className="size-3.5 animate-spin" />
                        ) : (
                          <AttachIcon className="size-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-full px-2.5 py-1 text-xs text-neutral-500 transition hover:bg-linen-hover"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={
                          !editText.trim() && editAttachmentIds.length === 0
                        }
                        className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`max-w-sm rounded-2xl px-3.5 py-2 text-sm ${
                    isSelf ? "bg-accent text-white" : "bg-canvas text-ink"
                  }`}
                >
                  {!isSelf && (
                    <p
                      className="mb-0.5 text-xs font-semibold"
                      style={{ color: sender?.color }}
                    >
                      {sender?.name ?? "Unknown"}
                    </p>
                  )}
                  {message.attachmentIds.length > 0 && (
                    <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                      {message.attachmentIds.map((id) => {
                        const item = mediaItems.find((i) => i.id === id);
                        if (!item) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setLightboxItem(item)}
                            className="overflow-hidden rounded-lg bg-black/10"
                          >
                            {item.type === "video" ? (
                              <video
                                src={item.src}
                                muted
                                playsInline
                                preload="metadata"
                                className="h-20 w-full object-cover"
                              />
                            ) : (
                              <img
                                src={item.src}
                                alt=""
                                loading="lazy"
                                className="h-20 w-full object-cover"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {message.text && (
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  )}
                  <p
                    className={`mt-1 text-[10px] ${isSelf ? "text-white/70" : "text-neutral-400"}`}
                  >
                    {formatTime(message.createdAt)}
                    {message.editedAt && " · edited"}
                  </p>
                </div>
              )}

              {isSelf && !isEditing && (
                <div className="order-last flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(message)}
                    title="Edit"
                    className="flex size-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-linen-hover hover:text-neutral-700"
                  >
                    <PencilIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(message.id)}
                    title="Delete"
                    className="flex size-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-linen bg-white px-4 py-3 sm:px-6">
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((id) => {
              const item = mediaItems.find((i) => i.id === id);
              if (!item) return null;
              return (
                <div
                  key={id}
                  className="relative size-14 overflow-hidden rounded-md bg-neutral-200 ring-1 ring-linen"
                >
                  {item.type === "video" ? (
                    <video
                      src={item.src}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={item.src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPending((prev) => prev.filter((p) => p !== id))
                    }
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <CloseIcon className="size-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            title="Attach from your library"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover"
          >
            <ImageIcon className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload from your device"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-linen-hover disabled:opacity-50"
          >
            {uploading ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <AttachIcon className="size-[18px]" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleUpload}
            className="hidden"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message as ${activeUser.name}`}
            className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() && pending.length === 0}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendIcon className="size-4" />
          </button>
        </div>
      </div>

      {showPicker && (
        <AttachMediaModal
          items={attachableMediaItems}
          onClose={() => setShowPicker(false)}
          onConfirm={(ids) => {
            setPending((prev) => [...prev, ...ids]);
            setShowPicker(false);
          }}
        />
      )}

      <input
        ref={editFileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleEditUpload}
        className="hidden"
      />
      {editShowPicker && (
        <AttachMediaModal
          items={attachableMediaItems}
          onClose={() => setEditShowPicker(false)}
          onConfirm={(ids) => {
            setEditAttachmentIds((prev) => [...prev, ...ids]);
            setEditShowPicker(false);
          }}
        />
      )}

      {lightboxItem && (
        <MediaLightbox
          items={[lightboxItem]}
          index={0}
          onClose={() => setLightboxItem(null)}
          onNavigate={() => {}}
        />
      )}
    </div>
  );
}
