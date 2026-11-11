import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatContent, ChatMessage, ChatUser } from "@/types/chat";
import {
  createContent,
  createUser,
  deleteContent,
  deleteMessage,
  editMessage,
  fetchContents,
  fetchMessages,
  fetchUsers,
  postMessage,
  updateContent,
  type ContentPatch,
} from "@/lib/api/chat";

const ACTIVE_USER_KEY = "media-gallery:chat:active-user-by-content:v1";
const POLL_INTERVAL_MS = 3000;

function loadActiveUserMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACTIVE_USER_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Multi-content chat, backed by the Node API in `server/` (see src/lib/api/chat.ts)
 * instead of localStorage — each ChatContent has its own independent user list and
 * message thread. "Which identity am I chatting as" per content is a pure client UI
 * preference, remembered in localStorage rather than sent to the server.
 */
export function useChat() {
  const [contents, setContents] = useState<ChatContent[]>([]);
  const [activeContentId, setActiveContentId] = useState<string | null>(null);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUserId, setActiveUserIdState] = useState<string | null>(null);
  const activeUserMapRef = useRef<Record<string, string>>(loadActiveUserMap());

  useEffect(() => {
    fetchContents()
      .then(setContents)
      .catch(() => {
        // No backend reachable yet — contents just stays empty until it is.
      });
  }, []);

  const selectContent = useCallback((id: string) => {
    setActiveContentId(id);
    setUsers([]);
    setMessages([]);
    setActiveUserIdState(activeUserMapRef.current[id] ?? null);
    fetchUsers(id)
      .then(setUsers)
      .catch(() => {});
    fetchMessages(id)
      .then(setMessages)
      .catch(() => {});
  }, []);

  // Poll for new messages while a content is open, so a second tab/window shows up
  // without a manual refresh — simple REST polling, no WebSocket dependency.
  useEffect(() => {
    if (!activeContentId) return;
    const id = activeContentId;
    const interval = window.setInterval(() => {
      fetchMessages(id)
        .then(setMessages)
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activeContentId]);

  const clearActiveContent = useCallback(() => {
    setActiveContentId(null);
    setUsers([]);
    setMessages([]);
    setActiveUserIdState(null);
  }, []);

  const addContent = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const content = await createContent(trimmed);
      setContents((prev) => [...prev, content]);
      selectContent(content.id);
      return content.id;
    },
    [selectContent],
  );

  const editContent = useCallback(async (id: string, patch: ContentPatch) => {
    const updated = await updateContent(id, patch);
    setContents((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }, []);

  const removeContent = useCallback(
    async (id: string) => {
      await deleteContent(id);
      setContents((prev) => prev.filter((c) => c.id !== id));
      if (activeContentId === id) {
        setActiveContentId(null);
        setUsers([]);
        setMessages([]);
        setActiveUserIdState(null);
      }
    },
    [activeContentId],
  );

  const addUser = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || !activeContentId) return null;
      const user = await createUser(activeContentId, trimmed);
      setUsers((prev) => [...prev, user]);
      setActiveUserIdState((prev) => prev ?? user.id);
      return user.id;
    },
    [activeContentId],
  );

  const setActiveUser = useCallback(
    (id: string) => {
      setActiveUserIdState(id);
      if (!activeContentId) return;
      const next = { ...activeUserMapRef.current, [activeContentId]: id };
      activeUserMapRef.current = next;
      try {
        window.localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(next));
      } catch {
        // Storage full or unavailable — the preference just won't persist across reloads.
      }
    },
    [activeContentId],
  );

  const sendMessage = useCallback(
    async (userId: string, text: string, attachmentIds: string[]) => {
      const trimmed = text.trim();
      if ((!trimmed && attachmentIds.length === 0) || !activeContentId) return;
      const message = await postMessage(
        activeContentId,
        userId,
        trimmed,
        attachmentIds,
      );
      setMessages((prev) => [...prev, message]);
    },
    [activeContentId],
  );

  const editChatMessage = useCallback(
    async (messageId: string, text: string, attachmentIds: string[]) => {
      const trimmed = text.trim();
      if ((!trimmed && attachmentIds.length === 0) || !activeContentId) return;
      const updated = await editMessage(
        activeContentId,
        messageId,
        trimmed,
        attachmentIds,
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? updated : m)),
      );
    },
    [activeContentId],
  );

  const deleteChatMessage = useCallback(
    async (messageId: string) => {
      if (!activeContentId) return;
      await deleteMessage(activeContentId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [activeContentId],
  );

  return {
    contents,
    activeContentId,
    selectContent,
    clearActiveContent,
    addContent,
    editContent,
    removeContent,
    users,
    activeUserId,
    messages,
    addUser,
    setActiveUser,
    sendMessage,
    editMessage: editChatMessage,
    deleteMessage: deleteChatMessage,
  };
}
