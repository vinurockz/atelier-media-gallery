import type { ViewMode } from "@/hooks/useViewMode";
import { GridIcon, ListIcon } from "@/components/icons";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/** Grid/list display switch. */
export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View"
      className="flex items-center rounded-md border border-linen bg-surface p-1"
    >
      <button
        type="button"
        aria-pressed={mode === "grid"}
        onClick={() => onChange("grid")}
        title="Grid view"
        className={`flex size-7 items-center justify-center rounded-[5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          mode === "grid"
            ? "bg-accent-soft text-accent"
            : "text-stone hover:text-ink"
        }`}
      >
        <GridIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-pressed={mode === "list"}
        onClick={() => onChange("list")}
        title="List view"
        className={`flex size-7 items-center justify-center rounded-[5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          mode === "list"
            ? "bg-accent-soft text-accent"
            : "text-stone hover:text-ink"
        }`}
      >
        <ListIcon className="size-4" />
      </button>
    </div>
  );
}
