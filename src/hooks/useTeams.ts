import { useCallback, useEffect, useRef, useState } from "react";
import type { TeamsMessagePage, TeamsOverview } from "@/types/teams";
import {
  fetchTeamsMessages,
  fetchTeamsOverview,
  markTeamsRead,
  sendTeamsMessage,
  TEAMS_STREAM_URL,
  uploadTeamsFile,
} from "@/lib/api/teams";

const PAGE_SIZE = 100;
const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "Something went wrong";

type OpenPage = TeamsMessagePage & { conversationId: string };

/**
 * State for the Teams module. The server stream only announces that something changed; this
 * refetches through the normal routes, so what arrives is always permission-checked.
 */
export function useTeams() {
  const [overview, setOverview] = useState<TeamsOverview | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [page, setPage] = useState<OpenPage | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Each loader numbers its requests so a slow, older response can't overwrite a newer one.
  const overviewRequest = useRef(0);
  const messagesRequest = useRef(0);
  const open = useRef({ id: activeId, limit });
  open.current = { id: activeId, limit };

  const loadOverview = useCallback(async () => {
    const ticket = ++overviewRequest.current;
    try {
      const next = await fetchTeamsOverview();
      if (ticket !== overviewRequest.current) return;
      setOverview(next);
      // Drop a conversation that was deleted, or that this user was removed from.
      setActiveId((id) =>
        id && next.conversations.some((c) => c.id === id) ? id : null,
      );
    } catch (err) {
      if (ticket === overviewRequest.current) setError(errorText(err));
    }
  }, []);

  const loadMessages = useCallback(async () => {
    const { id, limit: count } = open.current;
    const ticket = ++messagesRequest.current;
    if (!id) return;
    try {
      const next = await fetchTeamsMessages(id, count);
      if (ticket !== messagesRequest.current) return;
      setPage({ ...next, conversationId: id });
      if (document.visibilityState === "visible") await markTeamsRead(id);
      await loadOverview();
    } catch (err) {
      if (ticket === messagesRequest.current) setError(errorText(err));
    }
  }, [loadOverview]);

  useEffect(() => {
    void loadMessages();
  }, [activeId, limit, loadMessages]);

  useEffect(() => {
    const refresh = () => {
      void loadOverview();
      void loadMessages();
    };
    const source = new EventSource(TEAMS_STREAM_URL);
    // Also runs after every reconnect, picking up whatever was missed meanwhile.
    source.onopen = () => {
      setConnected(true);
      refresh();
    };
    source.onerror = () => setConnected(false);
    source.onmessage = (event: MessageEvent<string>) => {
      const change = JSON.parse(event.data) as {
        type: "overview" | "message";
        conversationId?: string;
      };
      if (change.conversationId === open.current.id) void loadMessages();
      else void loadOverview();
    };
    document.addEventListener("visibilitychange", refresh);
    void loadOverview();
    return () => {
      source.close();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadOverview, loadMessages]);

  const selectConversation = useCallback((id: string | null) => {
    setActiveId(id);
    setLimit(PAGE_SIZE);
    setError(null);
  }, []);

  /** Runs a change, then refreshes. Returns whether it worked; failures are shown. */
  const run = useCallback(
    async (change: () => Promise<unknown>) => {
      setError(null);
      try {
        await change();
      } catch (err) {
        setError(errorText(err));
        return false;
      }
      await Promise.all([loadOverview(), loadMessages()]);
      return true;
    },
    [loadOverview, loadMessages],
  );

  const send = useCallback(
    (
      conversationId: string,
      text: string,
      files: File[],
      parentId: string | null,
    ) =>
      run(async () => {
        const fileIds: string[] = [];
        for (const file of files) {
          fileIds.push((await uploadTeamsFile(conversationId, file)).id);
        }
        await sendTeamsMessage(conversationId, text, fileIds, parentId);
      }),
    [run],
  );

  return {
    overview,
    activeId,
    // Never show one conversation's messages under another's heading while loading.
    page: page && page.conversationId === activeId ? page : null,
    connected,
    error,
    clearError: () => setError(null),
    selectConversation,
    loadOlder: () => setLimit((n) => n + PAGE_SIZE),
    reload: loadOverview,
    run,
    send,
  };
}
