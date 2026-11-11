export interface ChatContent {
  id: string;
  name: string;
  /** Optional cover photo — a MediaItem id from the file manager, same as a message attachment. */
  imageMediaItemId: string | null;
  /** Optional free-text blurb shown in the content picker/edit modal. */
  description: string;
  createdAt: number;
}

export interface ChatUser {
  id: string;
  /** The ChatContent this user belongs to — users are scoped per content, not shared. */
  contentId: string;
  name: string;
  /** Avatar color (hex). */
  color: string;
}

export interface ChatMessage {
  id: string;
  contentId: string;
  /** Who sent it — one of ChatUser.id, scoped to the same content. */
  userId: string;
  text: string;
  /** MediaItem ids attached to this message (from the file manager or freshly uploaded). */
  attachmentIds: string[];
  createdAt: number;
  /** Set once the message has been edited; absent otherwise. */
  editedAt?: number;
}
