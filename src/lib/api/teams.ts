import type {
  TeamsMessage,
  TeamsMessagePage,
  TeamsOverview,
} from "@/types/teams";
import { request } from "@/lib/api/request";

const BASE = "/teams-app";
const part = encodeURIComponent;

const post = <T>(path: string, body?: unknown) =>
  request<T>(`${BASE}${path}`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const remove = (path: string) =>
  request<void>(`${BASE}${path}`, { method: "DELETE" });

/** Server-Sent Events: each event says only that something changed. */
export const TEAMS_STREAM_URL = `/api${BASE}/stream`;

export const teamsFileUrl = (fileId: string) =>
  `/api${BASE}/files/${part(fileId)}`;

export const fetchTeamsOverview = () =>
  request<TeamsOverview>(`${BASE}/overview`);

export const createTeam = (name: string, description: string) =>
  post<{ id: string; generalId: string }>("/teams", { name, description });

export const deleteTeam = (teamId: string) => remove(`/teams/${part(teamId)}`);

export const addTeamMember = (teamId: string, email: string) =>
  post<{ userId: string }>(`/teams/${part(teamId)}/members`, { email });

export const removeTeamMember = (teamId: string, userId: string) =>
  remove(`/teams/${part(teamId)}/members/${part(userId)}`);

export const createChannel = (
  teamId: string,
  name: string,
  isPrivate: boolean,
  memberIds: string[],
) =>
  post<{ id: string }>(`/teams/${part(teamId)}/channels`, {
    name,
    isPrivate,
    memberIds,
  });

export const createTeamsChat = (emails: string[], name: string) =>
  post<{ id: string }>("/chats", { emails, name });

export const fetchTeamsMessages = (conversationId: string, limit: number) =>
  request<TeamsMessagePage>(
    `${BASE}/conversations/${part(conversationId)}/messages?limit=${limit}`,
  );

export const sendTeamsMessage = (
  conversationId: string,
  text: string,
  fileIds: string[],
  parentId: string | null,
) =>
  post<TeamsMessage>(`/conversations/${part(conversationId)}/messages`, {
    text,
    fileIds,
    parentId,
  });

export const editTeamsMessage = (
  conversationId: string,
  messageId: string,
  text: string,
) =>
  request<TeamsMessage>(
    `${BASE}/conversations/${part(conversationId)}/messages/${part(messageId)}`,
    { method: "PUT", body: JSON.stringify({ text }) },
  );

export const deleteTeamsMessage = (conversationId: string, messageId: string) =>
  remove(
    `/conversations/${part(conversationId)}/messages/${part(messageId)}`,
  );

export const markTeamsRead = (conversationId: string) =>
  request<void>(`${BASE}/conversations/${part(conversationId)}/read`, {
    method: "POST",
  });

/** Multipart upload, so it can't go through the JSON-only request() helper. */
export async function uploadTeamsFile(
  conversationId: string,
  file: File,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `/api${BASE}/conversations/${part(conversationId)}/files`,
    { method: "POST", body: form, credentials: "same-origin" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return res.json() as Promise<{ id: string }>;
}
