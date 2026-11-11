import { useRef, useState, type ChangeEvent } from "react";
import { splitIntoSentences } from "@/lib/sentenceSplit";
import { CloseIcon, UploadIcon } from "@/components/icons";

type Props = {
  onClose: () => void;
  onCreate: (name: string, sentences: string[]) => Promise<void>;
};

/** Paste a big block of text (an essay, a 5000-word draft) or upload a .txt file, give it a
 * name, and it's split one sentence per bubble when the conversation is created. */
export function NewTextChatModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sentenceCount = splitIntoSentences(text).length;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setText(await file.text());
    setFileName(file.name);
  };

  const submit = async () => {
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(
        name.trim() || fileName || "Untitled conversation",
        sentences,
      );
    } catch {
      setError(
        "Couldn't reach the server to create this conversation. Make sure the backend (pnpm server / pnpm dev) is running, then try again.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-linen bg-surface shadow-lifted">
        <div className="flex items-center justify-between border-b border-linen px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">New text chat</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full text-stone transition-colors hover:bg-linen-hover"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Conversation name"
            aria-label="Conversation name"
            className="w-full rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
            }}
            placeholder="Paste a few words or thousands — each sentence becomes its own message."
            rows={10}
            aria-label="Text to convert"
            className="w-full resize-none rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />

          <div className="flex items-center justify-between text-xs text-stone">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-linen px-2.5 py-1 font-medium text-ink transition hover:bg-linen-hover"
            >
              <UploadIcon className="size-3.5" />
              Upload .txt file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFile}
              className="hidden"
            />
            <span>
              {sentenceCount > 0
                ? `${sentenceCount} ${sentenceCount === 1 ? "sentence" : "sentences"}`
                : ""}
            </span>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-linen px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-stone transition-colors hover:bg-linen-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sentenceCount === 0 || creating}
            onClick={() => void submit()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create conversation"}
          </button>
        </div>
      </div>
    </div>
  );
}
