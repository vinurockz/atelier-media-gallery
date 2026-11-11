/**
 * Splits a block of plain text (a pasted essay, an imported .txt file, a few words typed
 * into the composer) into one string per sentence, for the Text Chat module to turn into
 * one bubble each. Wrapping whitespace/newlines are collapsed first so a sentence that
 * wraps across lines in the source text still becomes a single bubble.
 */
export function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

/** Escapes text before it's stored as a message's initial HTML (see useTextChats/
 * NewTextChatModal) — mirrors server/db.mjs's escapeHtml for the same reason: the text
 * came from a plain-text source, not a rich editor, so it isn't HTML yet. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
