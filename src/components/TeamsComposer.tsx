import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { TeamsMember } from "@/types/teams";

type Props = {
  placeholder: string;
  /** People offered after typing "@". */
  people: TeamsMember[];
  onSend: (text: string, files: File[]) => Promise<boolean>;
};

const MAX_FILES = 10;

export function TeamsComposer({ placeholder, people, onSend }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const typedMention = /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1];
  const suggestions =
    typedMention === undefined
      ? []
      : people
          .filter((p) =>
            p.name.toLowerCase().startsWith(typedMention.toLowerCase()),
          )
          .slice(0, 5);

  const insertMention = (name: string) => {
    setText((value) => value.replace(/@[^\s@]*$/, `@${name} `));
    textRef.current?.focus();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (sending || (!text.trim() && files.length === 0)) return;
    setSending(true);
    // The draft is only cleared once the server has it.
    if (await onSend(text.trim(), files)) {
      setText("");
      setFiles([]);
    }
    setSending(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Enter that confirms an input-method word (Malayalam, Japanese, ...) must not send.
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-md border border-linen bg-surface p-2 focus-within:border-accent"
    >
      {suggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {suggestions.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => insertMention(person.name)}
              className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
            >
              @{person.name}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={4000}
        rows={2}
        aria-label={placeholder}
        placeholder={placeholder}
        className="w-full resize-y bg-transparent px-1 text-sm text-ink outline-none"
      />
      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${file.size}`}>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, i) => i !== index))}
                aria-label={`Remove ${file.name}`}
                className="rounded border border-linen px-2 py-1 text-xs text-ink"
              >
                {file.name} ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <label className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-stone focus-within:outline focus-within:outline-2 focus-within:outline-accent hover:bg-linen-hover">
          Attach files
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((list) => [...list, ...picked].slice(0, MAX_FILES));
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="submit"
          disabled={sending || (!text.trim() && files.length === 0)}
          className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
