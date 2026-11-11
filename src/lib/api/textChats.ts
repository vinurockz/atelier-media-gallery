import type { TextChatConversation } from "@/types/textChat";
import { request } from "@/lib/api/request";

export function fetchTextChats(): Promise<TextChatConversation[]> {
  return request<TextChatConversation[]>("/text-chats");
}

export function createTextChat(name: string): Promise<TextChatConversation> {
  return request<TextChatConversation>("/text-chats", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export type TextChatPatch = Partial<
  Pick<TextChatConversation, "name" | "messages">
>;

export function updateTextChat(
  id: string,
  patch: TextChatPatch,
): Promise<TextChatConversation> {
  return request<TextChatConversation>(`/text-chats/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteTextChat(id: string): Promise<void> {
  return request<void>(`/text-chats/${id}`, { method: "DELETE" });
}
