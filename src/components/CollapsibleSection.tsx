import { useState } from "react";
import { ChevronRightIcon } from "@/components/icons";

interface CollapsibleSectionProps {
  title: string;
  /** Short status shown next to the title when collapsed, e.g. "On" / "2 active". */
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** An expand/collapse panel section — used throughout the editors' right-side panels so a
 * long settings list (Photo body, Adjustments, layer effects, header/footer bands...) doesn't
 * force constant scrolling when most sections aren't being actively tweaked. */
export function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md ring-1 ring-neutral-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-800"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRightIcon
            className={`size-3.5 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="truncate">{title}</span>
        </span>
        {badge && (
          <span className="shrink-0 text-xs text-neutral-400">{badge}</span>
        )}
      </button>
      {open && <div className="border-t border-neutral-200">{children}</div>}
    </div>
  );
}
