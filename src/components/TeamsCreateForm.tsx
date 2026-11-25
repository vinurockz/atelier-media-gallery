import { useState, type FormEvent } from "react";
import type { Team } from "@/types/teams";
import { createChannel, createTeam, createTeamsChat } from "@/lib/api/teams";

export type CreateTarget =
  { kind: "team" } | { kind: "chat" } | { kind: "channel"; team: Team };

type Props = {
  target: CreateTarget;
  myId: string;
  onRun: (change: () => Promise<unknown>) => Promise<boolean>;
  /** Called with the conversation to open after creating. */
  onCreated: (conversationId: string) => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-linen px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-3 block text-sm font-medium";

/** The fields for a new team, channel or chat. */
export function TeamsCreateForm({ target, myId, onRun, onCreated }: Props) {
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    let conversationId = "";
    const done = await onRun(async () => {
      if (target.kind === "team") {
        conversationId = (await createTeam(name, detail)).generalId;
      } else if (target.kind === "channel") {
        conversationId = (
          await createChannel(target.team.id, name, isPrivate, memberIds)
        ).id;
      } else {
        const emails = detail.split(/[\s,;]+/).filter(Boolean);
        conversationId = (await createTeamsChat(emails, name)).id;
      }
    });
    setSaving(false);
    if (done) onCreated(conversationId);
  };

  return (
    <form onSubmit={submit}>
      {target.kind === "chat" && (
        <label className={labelClass}>
          People (email addresses, separated by commas)
          <textarea
            required
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <label className={labelClass}>
        {target.kind === "chat"
          ? "Group name (optional)"
          : target.kind === "team"
            ? "Team name"
            : "Channel name"}
        <input
          required={target.kind !== "chat"}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      {target.kind === "team" && (
        <label className={labelClass}>
          Description (optional)
          <input
            maxLength={500}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      {target.kind === "channel" && (
        <>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setPrivate(e.target.checked)}
            />
            Private (only the people you choose)
          </label>
          {isPrivate && (
            <fieldset className="mb-3 max-h-40 overflow-y-auto">
              <legend className="mb-1 text-sm font-medium">Members</legend>
              {target.team.members
                .filter((m) => m.id !== myId)
                .map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 py-0.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={memberIds.includes(member.id)}
                      onChange={(e) =>
                        setMemberIds((ids) =>
                          e.target.checked
                            ? [...ids, member.id]
                            : ids.filter((id) => id !== member.id),
                        )
                      }
                    />
                    {member.name}
                  </label>
                ))}
            </fieldset>
          )}
        </>
      )}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
