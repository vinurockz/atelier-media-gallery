import type { ChatContent, ChatMessage, ChatUser } from "@/types/chat";
import { request } from "@/lib/api/request";

export function fetchContents(): Promise<ChatContent[]> {
  return request<ChatContent[]>("/contents");
}

export function createContent(name: string): Promise<ChatContent> {
  return request<ChatContent>("/contents", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export type ContentPatch = Partial<
  Pick<ChatContent, "name" | "description" | "imageMediaItemId">
>;

export function updateContent(
  contentId: string,
  patch: ContentPatch,
): Promise<ChatContent> {
  return request<ChatContent>(`/contents/${contentId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteContent(contentId: string): Promise<void> {
  return request<void>(`/contents/${contentId}`, { method: "DELETE" });
}

export function fetchUsers(contentId: string): Promise<ChatUser[]> {
  return request<ChatUser[]>(`/contents/${contentId}/users`);
}

export function createUser(contentId: string, name: string): Promise<ChatUser> {
  return request<ChatUser>(`/contents/${contentId}/users`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function fetchMessages(contentId: string): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/contents/${contentId}/messages`);
}

export function postMessage(
  contentId: string,
  userId: string,
  text: string,
  attachmentIds: string[],
): Promise<ChatMessage> {
  return request<ChatMessage>(`/contents/${contentId}/messages`, {
    method: "POST",
    body: JSON.stringify({ userId, text, attachmentIds }),
  });
}

export function editMessage(
  contentId: string,
  messageId: string,
  text: string,
  attachmentIds: string[],
): Promise<ChatMessage> {
  return request<ChatMessage>(`/contents/${contentId}/messages/${messageId}`, {
    method: "PUT",
    body: JSON.stringify({ text, attachmentIds }),
  });
}

export function deleteMessage(
  contentId: string,
  messageId: string,
): Promise<void> {
  return request<void>(`/contents/${contentId}/messages/${messageId}`, {
    method: "DELETE",
  });
}

/**
 * Fetches a content's chat as a PDF and triggers a browser download of it.
 * `asUserId` (the currently active "chatting as" identity, if any) makes the
 * PDF mirror exactly what that user sees on screen — their own messages on
 * the right, everyone else's on the left — same as ChatView's `isSelf` split.
 */
export async function exportContentPdf(
  contentId: string,
  contentName: string,
  asUserId: string | null,
): Promise<void> {
  const query = asUserId ? `?asUserId=${encodeURIComponent(asUserId)}` : "";
  const res = await fetch(`/api/contents/${contentId}/export.pdf${query}`);
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${contentName}-chat.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
