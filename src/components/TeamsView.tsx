import { useState } from "react";
import { useTeams } from "@/hooks/useTeams";
import { conversationTitle } from "@/lib/teamsText";
import { TeamsConversationPane } from "@/components/TeamsConversationPane";
import {
  TeamsCreateForm,
  type CreateTarget,
} from "@/components/TeamsCreateForm";
import { TeamsDialog } from "@/components/TeamsDialog";
import { TeamsMembersPanel } from "@/components/TeamsMembersPanel";
import { TeamsNavButton } from "@/components/TeamsNavButton";

type DialogState =
  | { kind: "team" }
  | { kind: "chat" }
  | { kind: "channel"; teamId: string }
  | { kind: "members"; teamId: string }
  | null;

const headingClass = "text-xs font-semibold uppercase tracking-wide text-stone";
const linkClass = "text-xs font-medium text-accent hover:underline";

/** The Teams module: teams with channels, plus one-to-one and group chats. */
export function TeamsView() {
  const teams = useTeams();
  const [dialog, setDialog] = useState<DialogState>(null);
  const { overview, activeId, error } = teams;

  if (!overview) {
    return (
      <p role="status" className="p-6 text-sm text-stone">
        {error ?? "Loading Teams…"}
      </p>
    );
  }

  const myId = overview.me.id;
  const active = overview.conversations.find((c) => c.id === activeId);
  const chats = overview.conversations
    .filter((c) => c.kind === "chat")
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  const dialogTeam =
    dialog && "teamId" in dialog
      ? overview.teams.find((t) => t.id === dialog.teamId)
      : undefined;

  const closeDialog = () => {
    setDialog(null);
    teams.clearError();
  };

  const createTarget: CreateTarget | null =
    dialog?.kind === "team" || dialog?.kind === "chat"
      ? { kind: dialog.kind }
      : dialog?.kind === "channel" && dialogTeam
        ? { kind: "channel", team: dialogTeam }
        : null;

  const errorBanner = error && (
    <p
      role="alert"
      className="mb-3 rounded-md border border-linen bg-accent-soft px-3 py-2 text-sm text-ink"
    >
      {error}
    </p>
  );

  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label="Teams and chats"
        className={`w-full shrink-0 flex-col overflow-y-auto border-r border-linen bg-surface p-3 md:flex md:w-72 ${
          active ? "hidden" : "flex"
        }`}
      >
        <h1 className="font-serif text-xl text-ink">Teams</h1>
        <p className="mb-4 truncate text-xs text-stone">
          Signed in as {overview.me.email}
        </p>
        {!teams.connected && (
          <p role="status" className="mb-3 text-xs text-stone">
            Reconnecting…
          </p>
        )}
        {!dialog && errorBanner}

        <div className="mb-2 flex items-center justify-between">
          <h2 className={headingClass}>Chats</h2>
          <button
            type="button"
            onClick={() => setDialog({ kind: "chat" })}
            className={linkClass}
          >
            + New chat
          </button>
        </div>
        {chats.length === 0 && (
          <p className="text-xs text-stone">No chats yet.</p>
        )}
        {chats.map((chat) => (
          <TeamsNavButton
            key={chat.id}
            conversation={chat}
            label={conversationTitle(chat, myId)}
            prefix="•"
            active={chat.id === activeId}
            online={
              chat.members.length === 2 &&
              chat.members.some((m) => m.id !== myId && m.online)
            }
            onSelect={() => teams.selectConversation(chat.id)}
          />
        ))}

        <div className="mb-2 mt-5 flex items-center justify-between">
          <h2 className={headingClass}>Teams</h2>
          <button
            type="button"
            onClick={() => setDialog({ kind: "team" })}
            className={linkClass}
          >
            + New team
          </button>
        </div>
        {overview.teams.length === 0 && (
          <p className="text-xs text-stone">
            Create a team, or ask an owner to add your email.
          </p>
        )}
        {overview.teams.map((team) => (
          <div key={team.id} className="mb-3">
            <h3 className="truncate px-2 text-sm font-semibold text-ink">
              {team.name}
            </h3>
            {overview.conversations
              .filter((c) => c.teamId === team.id)
              .map((channel) => (
                <TeamsNavButton
                  key={channel.id}
                  conversation={channel}
                  label={channel.name}
                  prefix={channel.isPrivate ? "🔒" : "#"}
                  active={channel.id === activeId}
                  onSelect={() => teams.selectConversation(channel.id)}
                />
              ))}
            <div className="mt-1 flex gap-3 px-2">
              <button
                type="button"
                className={linkClass}
                onClick={() =>
                  setDialog({ kind: "channel", teamId: team.id })
                }
              >
                + Channel
              </button>
              <button
                type="button"
                className={linkClass}
                onClick={() =>
                  setDialog({ kind: "members", teamId: team.id })
                }
              >
                Members ({team.members.length})
              </button>
            </div>
          </div>
        ))}
      </nav>

      {active ? (
        <TeamsConversationPane
          key={active.id}
          conversation={active}
          myId={myId}
          page={teams.page}
          onBack={() => teams.selectConversation(null)}
          onLoadOlder={teams.loadOlder}
          onSend={teams.send}
          onRun={teams.run}
        />
      ) : (
        <p className="hidden flex-1 items-center justify-center p-6 text-sm text-stone md:flex">
          Pick a chat or channel to start talking.
        </p>
      )}

      {createTarget && (
        <TeamsDialog
          title={
            createTarget.kind === "channel"
              ? `New channel in ${createTarget.team.name}`
              : createTarget.kind === "team"
                ? "New team"
                : "New chat"
          }
          onClose={closeDialog}
        >
          {errorBanner}
          <TeamsCreateForm
            target={createTarget}
            myId={myId}
            onRun={teams.run}
            onCreated={(id) => {
              setDialog(null);
              teams.selectConversation(id);
            }}
          />
        </TeamsDialog>
      )}
      {dialog?.kind === "members" && dialogTeam && (
        <TeamsDialog
          title={`${dialogTeam.name} members`}
          onClose={closeDialog}
        >
          {errorBanner}
          <TeamsMembersPanel
            team={dialogTeam}
            myId={myId}
            onRun={teams.run}
            onGone={closeDialog}
          />
        </TeamsDialog>
      )}
    </div>
  );
}
