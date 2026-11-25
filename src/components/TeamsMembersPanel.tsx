import { useState, type FormEvent } from "react";
import type { Team } from "@/types/teams";
import { addTeamMember, deleteTeam, removeTeamMember } from "@/lib/api/teams";

type Props = {
  team: Team;
  myId: string;
  onRun: (change: () => Promise<unknown>) => Promise<boolean>;
  /** Called after leaving or deleting the team. */
  onGone: () => void;
};

const smallButton =
  "rounded-md border border-linen px-2 py-1 text-xs font-medium hover:bg-linen-hover";

export function TeamsMembersPanel({ team, myId, onRun, onGone }: Props) {
  const [email, setEmail] = useState("");
  const isOwner = team.myRole === "owner";

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (await onRun(() => addTeamMember(team.id, email))) setEmail("");
  };

  const leave = async () => {
    if (!window.confirm(`Leave "${team.name}"?`)) return;
    if (await onRun(() => removeTeamMember(team.id, myId))) onGone();
  };

  const destroy = async () => {
    const question = `Delete "${team.name}" with all its channels, messages and files? This can't be undone.`;
    if (!window.confirm(question)) return;
    if (await onRun(() => deleteTeam(team.id))) onGone();
  };

  return (
    <div>
      {isOwner && (
        <form onSubmit={add} className="mb-3 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email of the person to add"
            placeholder="Email of a registered person"
            className="min-w-0 flex-1 rounded-md border border-linen px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" className={smallButton}>
            Add
          </button>
        </form>
      )}
      <ul className="mb-4 max-h-60 overflow-y-auto">
        {team.members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-2 py-1.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm">
                {member.name}
                {member.role === "owner" ? " (owner)" : ""}
                {member.online ? " · online" : ""}
              </span>
              <span className="block truncate text-xs text-stone">
                {member.email}
              </span>
            </span>
            {isOwner && member.id !== myId && (
              <button
                type="button"
                className={smallButton}
                onClick={() => {
                  if (window.confirm(`Remove ${member.name}?`)) {
                    void onRun(() => removeTeamMember(team.id, member.id));
                  }
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={isOwner ? destroy : leave}
        className={smallButton}
      >
        {isOwner ? "Delete team" : "Leave team"}
      </button>
    </div>
  );
}
