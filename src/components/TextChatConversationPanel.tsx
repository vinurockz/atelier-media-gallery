import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/types/media";
import type { TextChatConversation, TextChatMessage } from "@/types/textChat";
import type { TextChatPatch } from "@/lib/api/textChats";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { splitIntoSentences, escapeHtml } from "@/lib/sentenceSplit";
import { TextChatMessageBubble } from "@/components/TextChatMessageBubble";
import { AttachMediaModal } from "@/components/AttachMediaModal";
import { ChevronLeftIcon, SendIcon, TrashIcon } from "@/components/icons";

type Props = {
  conversation: TextChatConversation;
  mediaItems: MediaItem[];
  onPatch: (patch: TextChatPatch) => void;
  onFlush: () => void;
  onDelete: () => void;
  onClose: () => void;
  onImportFiles: (
    conversationName: string,
    files: File[],
  ) => Promise<ImportZipOutcome>;
};

function newMessage(sentence: string): TextChatMessage {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    html: escapeHtml(sentence),
    highlighted: false,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** The open conversation — a scrollable chat-bubble log (one bubble per sentence) plus a
 * composer that appends more sentences. Every change goes through `onPatch`, which
 * useTextChats debounces before saving, same model as NoteEditor/TaskEditor. */
export function TextChatConversationPanel({
  conversation,
  mediaItems,
  onPatch,
  onFlush,
  onDelete,
  onClose,
  onImportFiles,
}: Props) {
  const [draft, setDraft] = useState("");
  const [attachingTo, setAttachingTo] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Uploads/async edits resolve after the user may have typed more — always patch
  // against the latest messages, not a stale closure.
  const latestMessages = useRef(conversation.messages);
  useEffect(() => {
    latestMessages.current = conversation.messages;
  }, [conversation.messages]);

  const setMessages = (messages: TextChatMessage[]) => {
    latestMessages.current = messages;
    onPatch({ messages });
  };

  const addSentences = () => {
    const sentences = splitIntoSentences(draft);
    if (sentences.length === 0) return;
    setMessages([...latestMessages.current, ...sentences.map(newMessage)]);
    setDraft("");
    onFlush();
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  };

  const updateMessage = (id: string, patch: Partial<TextChatMessage>) =>
    setMessages(
      latestMessages.current.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m,
      ),
    );

  const deleteMessage = (id: string) =>
    setMessages(latestMessages.current.filter((m) => m.id !== id));

  const addAttachments = (messageId: string, mediaItemIds: string[]) => {
    const message = latestMessages.current.find((m) => m.id === messageId);
    if (!message) return;
    updateMessage(messageId, {
      attachments: [
        ...message.attachments,
        ...mediaItemIds.map((mediaItemId) => ({
          id: crypto.randomUUID(),
          mediaItemId,
        })),
      ],
    });
  };

  const removeAttachment = (messageId: string, attachmentId: string) => {
    const message = latestMessages.current.find((m) => m.id === messageId);
    if (!message) return;
    updateMessage(messageId, {
      attachments: message.attachments.filter((a) => a.id !== attachmentId),
    });
  };

  const uploadToMessage = async (messageId: string, files: File[]) => {
    const result = await onImportFiles(conversation.name, files);
    if (result.items.length > 0) {
      addAttachments(
        messageId,
        result.items.map((item) => item.id),
      );
    }
  };

  const confirmDelete = () => {
    if (window.confirm(`Delete "${conversation.name}"?`)) onDelete();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-linen bg-white px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to conversations"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <input
          value={conversation.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          onBlur={onFlush}
          placeholder="Conversation name"
          aria-label="Conversation name"
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-ink outline-none placeholder:text-stone"
        />
        <button
          type="button"
          onClick={confirmDelete}
          aria-label="Delete conversation"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-stone transition hover:bg-linen-hover hover:text-red-600"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto bg-canvas px-4 py-4"
      >
        {conversation.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone">
            No sentences yet. Type below to add some.
          </p>
        ) : (
          conversation.messages.map((message, i) => (
            <TextChatMessageBubble
              key={message.id}
              message={message}
              side={i % 2 === 0 ? "left" : "right"}
              mediaItems={mediaItems}
              onChangeHtml={(html) => updateMessage(message.id, { html })}
              onToggleHighlight={() =>
                updateMessage(message.id, {
                  highlighted: !message.highlighted,
                })
              }
              onDelete={() => deleteMessage(message.id)}
              onOpenAttach={() => setAttachingTo(message.id)}
              onUploadFiles={(files) => uploadToMessage(message.id, files)}
              onRemoveAttachment={(attachmentId) =>
                removeAttachment(message.id, attachmentId)
              }
            />
          ))
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-linen bg-white px-4 py-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addSentences();
            }
          }}
          placeholder="Add more words — split into sentences automatically"
          rows={1}
          aria-label="Add text to this conversation"
          className="min-w-0 flex-1 resize-none rounded-full border border-linen px-3.5 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={addSentences}
          disabled={draft.trim().length === 0}
          aria-label="Add"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon className="size-4" />
        </button>
      </div>

      {attachingTo && (
        <AttachMediaModal
          items={mediaItems.filter((m) => m.type !== "pdf")}
          onClose={() => setAttachingTo(null)}
          onConfirm={(ids) => {
            addAttachments(attachingTo, ids);
            setAttachingTo(null);
          }}
          title="Add image or video to sentence"
        />
      )}
    </div>
  );
}
