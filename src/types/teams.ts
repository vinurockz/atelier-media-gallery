/** Teams module. Shared between accounts (not per-customer) — see server/teams.mjs. */

export type TeamsPerson = { id: string; name: string; email: string };

export type TeamsMember = TeamsPerson & { online: boolean };

export type Team = {
  id: string;
  name: string;
  description: string;
  myRole: "owner" | "member";
  members: (TeamsMember & { role: "owner" | "member" })[];
};

/** A channel inside a team, or a one-to-one/group chat (`teamId` is null for chats). */
export type TeamsConversation = {
  id: string;
  kind: "channel" | "chat";
  teamId: string | null;
  /** Empty for a chat that was never named — show the other members' names instead. */
  name: string;
  isPrivate: boolean;
  createdBy: string;
  members: TeamsMember[];
  unread: number;
  mentions: number;
  lastMessageAt: number;
};

export type TeamsFile = {
  id: string;
  name: string;
  size: number;
  isImage: boolean;
};

export type TeamsMessage = {
  id: string;
  conversationId: string;
  author: TeamsPerson;
  /** Set on a reply: the id of the post it answers. */
  parentId: string | null;
  text: string;
  files: TeamsFile[];
  mentionIds: string[];
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
};

export type TeamsOverview = {
  me: TeamsPerson;
  teams: Team[];
  conversations: TeamsConversation[];
};

export type TeamsMessagePage = { hasMore: boolean; messages: TeamsMessage[] };
