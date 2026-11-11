import { ChevronRightIcon } from "@/components/icons";

export interface Crumb {
  label: string;
  onClick?: () => void;
}

/** "Archive > Category > Folder" trail; the current location has no onClick. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
      {items.map((item, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1">
          {i > 0 && (
            <ChevronRightIcon className="size-3.5 shrink-0 text-stone/60" />
          )}
          {item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="truncate rounded-md px-2 py-1 font-serif text-[1.05rem] text-stone transition-colors hover:bg-linen-hover hover:text-ink"
            >
              {item.label}
            </button>
          ) : (
            <span className="truncate rounded-md px-2 py-1 font-serif text-[1.05rem] text-ink">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
