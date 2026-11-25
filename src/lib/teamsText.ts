import type { TeamsConversation } from "@/types/teams";

/** A channel's name, a chat's chosen name, or else the other people in the chat. */
export function conversationTitle(
  conversation: TeamsConversation,
  myId: string,
): string {
  if (conversation.name) return conversation.name;
  const others = conversation.members.filter((m) => m.id !== myId);
  return others.map((m) => m.name).join(", ") || "Chat";
}

export type TextPart = {
  key: number;
  text: string;
  kind: "plain" | "mention" | "link";
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits a message so @mentions of known people and web links can be styled. */
export function splitMessageText(text: string, names: string[]): TextPart[] {
  // Longest first, so "@Ann Lee" wins over "@Ann".
  const mentions = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => `@${escapeRegExp(name)}`);
  const pattern = new RegExp(
    `(${["https?://[^\\s<>]+", ...mentions].join("|")})`,
    "gi",
  );
  // With one capturing group, split() puts every match at an odd index.
  return text.split(pattern).map((piece, index) => ({
    key: index,
    text: piece,
    kind:
      index % 2 === 0 ? "plain" : piece.startsWith("@") ? "mention" : "link",
  }));
}
