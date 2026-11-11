import { useCallback, useEffect, useRef, useState } from "react";
import type { TextChatConversation } from "@/types/textChat";
import {
  createTextChat as createTextChatRemote,
  deleteTextChat as deleteTextChatRemote,
  fetchTextChats,
  updateTextChat,
  type TextChatPatch,
} from "@/lib/api/textChats";

const POLL_INTERVAL_MS = 5000;
const SAVE_DEBOUNCE_MS = 600;

/**
 * Text Chat conversations, backed by the Node API in `server/` — same durable-JSON-file
 * model as Notes/Tasks. Edits (name, messages) update local state immediately and save
 * remotely on a short debounce per conversation, so typing a sentence or dragging the
 * highlight toggle doesn't fire a request per event.
 */
export function useTextChats() {
  const [conversations, setConversations] = useState<TextChatConversation[]>(
    [],
  );
  const saveTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, TextChatPatch>>(new Map());

  useEffect(() => {
    fetchTextChats()
      .then(setConversations)
      .catch(() => {
        // No backend reachable yet — stays empty until it is.
      });
  }, []);

  // Light polling so a second tab picks up changes, same interval as useNotes.
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchTextChats()
        .then(setConversations)
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const flushConversation = useCallback((id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      saveTimers.current.delete(id);
    }
    const patch = pendingPatches.current.get(id);
    if (!patch) return;
    pendingPatches.current.delete(id);
    void updateTextChat(id, patch).catch(() => {});
  }, []);

  const patchConversation = useCallback(
    (id: string, patch: TextChatPatch) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
        ),
      );
      const existing = pendingPatches.current.get(id) ?? {};
      pendingPatches.current.set(id, { ...existing, ...patch });

      const timer = saveTimers.current.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      saveTimers.current.set(
        id,
        window.setTimeout(() => flushConversation(id), SAVE_DEBOUNCE_MS),
      );
    },
    [flushConversation],
  );

  const addConversation = useCallback(async (name: string) => {
    const conversation = await createTextChatRemote(name);
    setConversations((prev) => [conversation, ...prev]);
    return conversation.id;
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    const timer = saveTimers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    saveTimers.current.delete(id);
    pendingPatches.current.delete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    await deleteTextChatRemote(id).catch(() => {});
  }, []);

  // Appends the second conversation's messages onto the end of the first, under the given
  // name, then deletes the second — a one-time merge, not a link, so the result stays an
  // ordinary conversation afterward.
  const combineConversations = useCallback(
    async (firstId: string, secondId: string, name: string) => {
      flushConversation(firstId);
      flushConversation(secondId);
      const first = conversations.find((c) => c.id === firstId);
      const second = conversations.find((c) => c.id === secondId);
      if (!first || !second) return;
      const trimmedName = name.trim() || first.name;
      const messages = [...first.messages, ...second.messages];
      setConversations((prev) =>
        prev
          .filter((c) => c.id !== secondId)
          .map((c) =>
            c.id === firstId
              ? { ...c, name: trimmedName, messages, updatedAt: Date.now() }
              : c,
          ),
      );
      await updateTextChat(firstId, { name: trimmedName, messages }).catch(
        () => {},
      );
      await deleteTextChatRemote(secondId).catch(() => {});
    },
    [conversations, flushConversation],
  );

  return {
    conversations,
    addConversation,
    patchConversation,
    flushConversation,
    removeConversation,
    combineConversations,
  };
}
