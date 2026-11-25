import { useEffect, useRef, useState } from "react";
import type {
  TeamsConversation,
  TeamsMessage,
  TeamsMessagePage,
} from "@/types/teams";
import { deleteTeamsMessage, editTeamsMessage } from "@/lib/api/teams";
import { conversationTitle } from "@/lib/teamsText";
import { TeamsComposer } from "@/components/TeamsComposer";
import { TeamsMessageItem } from "@/components/TeamsMessageItem";

type Props = {
  conversation: TeamsConversation;
  myId: string;
  page: (TeamsMessagePage & { conversationId: string }) | null;
  onBack: () => void;
  onLoadOlder: () => void;
  onSend: (
    conversationId: string,
    text: string,
    files: File[],
    parentId: string | null,
  ) => Promise<boolean>;
  onRun: (change: () => Promise<unknown>) => Promise<boolean>;
};

export function TeamsConversationPane({
  conversation,
  myId,
  page,
  onBack,
  onLoadOlder,
  onSend,
  onRun,
}: Props) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = page?.messages ?? [];
  const posts = messages.filter((m) => !m.parentId);
  const newestPostId = posts.at(-1)?.id;
  const title = conversationTitle(conversation, myId);
  const names = conversation.members.map((m) => m.name);
  const people = conversation.members.filter((m) => m.id !== myId);
  const onlineCount = people.filter((m) => m.online).length;

  // Follow new posts to the bottom; editing, replying or loading older ones stays put.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [newestPostId]);

  const item = (message: TeamsMessage, onReply?: () => void) => (
    <TeamsMessageItem
      message={message}
      myId={myId}
      memberNames={names}
      onReply={onReply}
      onEdit={(text) =>
        onRun(() => editTeamsMessage(conversation.id, message.id, text))
      }
      onDelete={() =>
        void onRun(() => deleteTeamsMessage(conversation.id, message.id))
      }
    />
  );

  return (
    <section aria-label={title} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-b border-linen bg-surface px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="mb-1 text-xs font-medium text-accent md:hidden"
        >
          ← All conversations
        </button>
        <h2 className="truncate font-serif text-lg text-ink">
          {conversation.kind === "channel" ? "# " : ""}
          {title}
        </h2>
        <p className="truncate text-xs text-stone">
          {conversation.isPrivate && conversation.kind === "channel"
            ? "Private channel · "
            : ""}
          {conversation.members.length} members · {onlineCount} online besides
          you
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {page?.hasMore && (
          <button
            type="button"
            onClick={onLoadOlder}
            className="mx-auto mb-3 block text-xs font-medium text-accent"
          >
            Load older messages
          </button>
        )}
        {!page ? (
          <p className="text-sm text-stone">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-stone">No messages yet. Say hello.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((post) => {
              const replies = messages.filter((m) => m.parentId === post.id);
              return (
                <li
                  key={post.id}
                  className="rounded-lg border border-linen bg-surface p-1"
                >
                  {item(post, () => setReplyingTo(post.id))}
                  {(replies.length > 0 || replyingTo === post.id) && (
                    <div className="ml-4 border-l-2 border-linen pl-2">
                      {replies.map((reply) => (
                        <div key={reply.id}>{item(reply)}</div>
                      ))}
                      {replyingTo === post.id && (
                        <div className="p-2">
                          <TeamsComposer
                            placeholder="Write a reply"
                            people={people}
                            onSend={async (text, files) => {
                              const sent = await onSend(
                                conversation.id,
                                text,
                                files,
                                post.id,
                              );
                              if (sent) setReplyingTo(null);
                              return sent;
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="mt-1 text-xs text-stone"
                          >
                            Cancel reply
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-linen p-3">
        <TeamsComposer
          placeholder={`Message ${title}`}
          people={people}
          onSend={(text, files) => onSend(conversation.id, text, files, null)}
        />
      </div>
    </section>
  );
}
