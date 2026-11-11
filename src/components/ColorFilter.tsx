import { COLOR_ORDER, COLOR_SWATCHES } from "@/lib/color";
import type { ColorName } from "@/types/media";

interface ColorFilterProps {
  active: ColorName | "all";
  onChange: (color: ColorName | "all") => void;
  counts: Partial<Record<ColorName, number>>;
}

export function ColorFilter({ active, onChange, counts }: ColorFilterProps) {
  const available = COLOR_ORDER.filter((color) => (counts[color] ?? 0) > 0);

  if (available.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Color
      </span>
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={active === "all"}
        className={`rounded-full px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          active === "all"
            ? "bg-neutral-900 text-white"
            : "bg-white text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-100"
        }`}
      >
        All
      </button>
      {available.map((color) => {
        const isActive = active === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-pressed={isActive}
            title={`${color} (${counts[color] ?? 0})`}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isActive
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100"
            }`}
          >
            <span
              className="size-3 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: COLOR_SWATCHES[color] }}
            />
            {color}
          </button>
        );
      })}
    </div>
  );
}
