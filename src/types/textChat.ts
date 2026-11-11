/** A picture or video attached to one message bubble — same "opaque reference to a
 * library MediaItem" model as Notes'/Tasks' image blocks (see src/types/notes.ts). */
export interface ChatAttachment {
  id: string;
  mediaItemId: string;
}

export interface TextChatMessage {
  id: string;
  /** Sanitized rich-text HTML for this one sentence — bold/italic/font-size via the
   * execCommand model in SentenceTextBlock.tsx, same approach as NoteTextBlock. */
  html: string;
  highlighted: boolean;
  attachments: ChatAttachment[];
  createdAt: number;
  updatedAt: number;
}

export interface TextChatConversation {
  id: string;
  name: string;
  messages: TextChatMessage[];
  createdAt: number;
  updatedAt: number;
}
