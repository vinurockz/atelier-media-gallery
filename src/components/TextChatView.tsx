import { useState } from "react";
import type { MediaItem } from "@/types/media";
import type { TextChatConversation, TextChatMessage } from "@/types/textChat";
import type { TextChatPatch } from "@/lib/api/textChats";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { escapeHtml } from "@/lib/sentenceSplit";
import { NewTextChatModal } from "@/components/NewTextChatModal";
import { TextChatConversationPanel } from "@/components/TextChatConversationPanel";
import {
  CheckIcon,
  MergeIcon,
  MessagesSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

type Props = {
  conversations: TextChatConversation[];
  mediaItems: MediaItem[];
  onCreate: (name: string) => Promise<string>;
  onPatch: (id: string, patch: TextChatPatch) => void;
  onFlush: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onCombine: (firstId: string, secondId: string, name: string) => Promise<void>;
  onImportFiles: (
    conversationName: string,
    files: File[],
  ) => Promise<ImportZipOutcome>;
};

function toMessages(sentences: string[]): TextChatMessage[] {
  const now = Date.now();
  return sentences.map((sentence) => ({
    id: crypto.randomUUID(),
    html: escapeHtml(sentence),
    highlighted: false,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }));
}

/** Grid of Text Chat conversations — each one a big block of pasted/imported text turned
 * into a scrollable, chat-bubble-style conversation. "Combine" lets you pick two cards and
 * merge them into one. */
export function TextChatView({
  conversations,
  mediaItems,
  onCreate,
  onPatch,
  onFlush,
  onDelete,
  onCombine,
  onImportFiles,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [combineMode, setCombineMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [combineName, setCombineName] = useState("");
  const [combining, setCombining] = useState(false);

  const openConversation = openId
    ? (conversations.find((c) => c.id === openId) ?? null)
    : null;

  const handleCreate = async (name: string, sentences: string[]) => {
    const id = await onCreate(name);
    onPatch(id, { messages: toMessages(sentences) });
    onFlush(id);
    setShowNew(false);
    setOpenId(id);
  };

  const handleDelete = async (id: string) => {
    const convo = conversations.find((c) => c.id === id);
    if (!convo || !window.confirm(`Delete "${convo.name}"?`)) return;
    if (openId === id) setOpenId(null);
    await onDelete(id);
  };

  const exitCombineMode = () => {
    setCombineMode(false);
    setSelected([]);
    setCombineName("");
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      const next = [...prev, id];
      if (next.length === 2) {
        const first = conversations.find((c) => c.id === next[0]);
        if (first) setCombineName(first.name);
      }
      return next;
    });
  };

  const confirmCombine = async () => {
    if (selected.length !== 2) return;
    setCombining(true);
    try {
      await onCombine(selected[0], selected[1], combineName);
    } finally {
      setCombining(false);
      exitCombineMode();
    }
  };

  if (openConversation) {
    return (
      <TextChatConversationPanel
        conversation={openConversation}
        mediaItems={mediaItems}
        onPatch={(patch) => onPatch(openConversation.id, patch)}
        onFlush={() => onFlush(openConversation.id)}
        onDelete={() => void handleDelete(openConversation.id)}
        onClose={() => {
          onFlush(openConversation.id);
          setOpenId(null);
        }}
        onImportFiles={onImportFiles}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linen bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <MessagesSquareIcon className="size-4 text-stone" />
          <h1 className="text-base font-medium text-ink">Text Chat</h1>
        </div>
        <div className="flex items-center gap-2">
          {combineMode ? (
            <button
              type="button"
              onClick={exitCombineMode}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-stone transition hover:bg-linen-hover"
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCombineMode(true)}
                disabled={conversations.length < 2}
                className="flex items-center gap-1.5 rounded-full border border-linen px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-linen-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MergeIcon className="size-3.5" />
                Combine
              </button>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover"
              >
                <PlusIcon className="size-3.5" />
                New text chat
              </button>
            </>
          )}
        </div>
      </div>

      {combineMode && (
        <div className="flex flex-wrap items-center gap-2 border-b border-linen bg-accent-soft px-4 py-2.5 text-xs text-ink sm:px-6">
          <span>
            {selected.length < 2
              ? `Pick ${2 - selected.length} more conversation${
                  selected.length === 1 ? "" : "s"
                } to combine.`
              : "Name the combined conversation:"}
          </span>
          {selected.length === 2 && (
            <>
              <input
                value={combineName}
                onChange={(e) => setCombineName(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-linen px-2 py-1 text-xs text-ink outline-none focus:border-accent"
              />
              <button
                type="button"
                disabled={combining}
                onClick={() => void confirmCombine()}
                className="rounded-full bg-accent px-3 py-1 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
              >
                {combining ? "Combining…" : "Combine"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessagesSquareIcon className="size-10 text-neutral-300" />
            <p className="mt-3 text-sm text-stone">
              No text chats yet. Paste or upload a block of text to turn it into
              a conversation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {conversations.map((conversation) => {
              const isSelected = selected.includes(conversation.id);
              return (
                <div
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    combineMode
                      ? toggleSelected(conversation.id)
                      : setOpenId(conversation.id)
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    if (combineMode) toggleSelected(conversation.id);
                    else setOpenId(conversation.id);
                  }}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white p-4 text-left shadow-soft transition hover:shadow-lifted ${
                    isSelected
                      ? "border-accent ring-2 ring-accent"
                      : "border-linen"
                  }`}
                >
                  {combineMode && (
                    <span
                      className={`absolute right-3 top-3 flex size-5 items-center justify-center rounded-full ring-1 ${
                        isSelected
                          ? "bg-accent text-white ring-accent"
                          : "bg-white text-transparent ring-linen"
                      }`}
                    >
                      <CheckIcon className="size-3" />
                    </span>
                  )}
                  <MessagesSquareIcon className="size-5 text-accent" />
                  <h2 className="mt-2 truncate text-sm font-medium text-ink">
                    {conversation.name || "Untitled conversation"}
                  </h2>
                  <p className="mt-0.5 text-xs text-stone">
                    {conversation.messages.length}{" "}
                    {conversation.messages.length === 1
                      ? "sentence"
                      : "sentences"}
                  </p>
                  {!combineMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(conversation.id);
                      }}
                      aria-label="Delete conversation"
                      className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-stone opacity-0 transition hover:bg-linen-hover hover:text-red-600 group-hover:opacity-100"
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && (
        <NewTextChatModal
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
