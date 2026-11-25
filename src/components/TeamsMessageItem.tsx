import { useState } from "react";
import type { TeamsMessage } from "@/types/teams";
import { teamsFileUrl } from "@/lib/api/teams";
import { splitMessageText } from "@/lib/teamsText";
import { formatBytes } from "@/lib/formatBytes";

type Props = {
  message: TeamsMessage;
  myId: string;
  memberNames: string[];
  onEdit: (text: string) => Promise<boolean>;
  onDelete: () => void;
  /** Absent on replies: threads are one level deep. */
  onReply?: () => void;
};

const actionClass =
  "rounded px-1.5 py-0.5 text-xs text-stone hover:bg-linen-hover hover:text-ink";

export function TeamsMessageItem({
  message,
  myId,
  memberNames,
  onEdit,
  onDelete,
  onReply,
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const mine = message.author.id === myId;
  const mentionsMe = message.mentionIds.includes(myId);

  const saveEdit = async () => {
    if (draft !== null && (await onEdit(draft))) setDraft(null);
  };

  return (
    <article
      className={`rounded-md px-3 py-2 ${mentionsMe ? "bg-accent-soft" : ""}`}
    >
      <header className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold text-ink">
          {message.author.name}
        </span>
        <time
          dateTime={new Date(message.createdAt).toISOString()}
          className="text-xs text-stone"
        >
          {new Date(message.createdAt).toLocaleString()}
        </time>
        {message.editedAt && !message.deleted && (
          <span className="text-xs text-stone">(edited)</span>
        )}
      </header>

      {message.deleted ? (
        <p className="text-sm italic text-stone">This message was deleted.</p>
      ) : draft !== null ? (
        <div className="mt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={4000}
            rows={3}
            aria-label="Edit message"
            className="w-full rounded-md border border-linen bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-accent"
          />
          <button type="button" onClick={saveEdit} className={actionClass}>
            Save
          </button>
          <button
            type="button"
            onClick={() => setDraft(null)}
            className={actionClass}
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm text-ink">
          {splitMessageText(message.text, memberNames).map((piece) =>
            piece.kind === "link" ? (
              <a
                key={piece.key}
                href={piece.text}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                {piece.text}
              </a>
            ) : (
              <span
                key={piece.key}
                className={
                  piece.kind === "mention"
                    ? "font-semibold text-accent"
                    : undefined
                }
              >
                {piece.text}
              </span>
            ),
          )}
        </p>
      )}

      {message.files.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-2">
          {message.files.map((file) => (
            <li key={file.id}>
              <a
                href={teamsFileUrl(file.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-linen bg-surface p-2 text-xs text-ink hover:border-accent"
              >
                {file.isImage && (
                  <img
                    src={teamsFileUrl(file.id)}
                    alt=""
                    loading="lazy"
                    width={192}
                    height={128}
                    className="mb-1 h-32 w-48 rounded object-cover"
                  />
                )}
                {file.name} · {formatBytes(file.size)}
              </a>
            </li>
          ))}
        </ul>
      )}

      {draft === null && (
        <div className="mt-0.5 flex gap-1">
          {onReply && (
            <button type="button" onClick={onReply} className={actionClass}>
              Reply
            </button>
          )}
          {mine && !message.deleted && (
            <>
              <button
                type="button"
                onClick={() => setDraft(message.text)}
                className={actionClass}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete this message?")) onDelete();
                }}
                className={actionClass}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
