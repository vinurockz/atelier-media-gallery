import type { TeamsConversation } from "@/types/teams";

type Props = {
  conversation: TeamsConversation;
  label: string;
  prefix: string;
  active: boolean;
  online?: boolean;
  onSelect: () => void;
};

/** One channel or chat in the left list, with its unread and mention badges. */
export function TeamsNavButton({
  conversation,
  label,
  prefix,
  active,
  online,
  onSelect,
}: Props) {
  const { unread, mentions } = conversation;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-accent-soft text-accent" : "text-ink hover:bg-linen-hover"
      } ${unread > 0 ? "font-semibold" : ""}`}
    >
      <span aria-hidden="true" className="w-3 shrink-0 text-center text-stone">
        {prefix}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {online && (
        <span className="shrink-0 text-[11px] font-normal text-stone">
          ● online
        </span>
      )}
      {unread > 0 && (
        <span className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] text-surface">
          {mentions > 0 ? "@ " : ""}
          {unread}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </button>
  );
}
