import type { BlockKind } from "@/types/website";
import { BLOCK_PALETTE, type PaletteEntry } from "@/lib/websiteBlocks";

type Props = {
  onStartDrag: (kind: BlockKind, e: React.PointerEvent) => void;
};

const GROUPS: PaletteEntry["group"][] = [
  "Structure",
  "Content",
  "Showcase",
  "Interactive",
];

/** Left panel of the page canvas — pointerdown on a button starts a drag the canvas
 * itself tracks (ghost chip + hit-testing against column rects via lib/dragReorder.ts),
 * since the canvas owns the registered column element refs. */
export function BlockPalettePanel({ onStartDrag }: Props) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-linen bg-white px-3 py-3">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone">
            {group}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {BLOCK_PALETTE.filter((entry) => entry.group === group).map(
              (entry) => (
                <button
                  key={entry.kind}
                  type="button"
                  onPointerDown={(e) => onStartDrag(entry.kind, e)}
                  className="flex flex-col items-center gap-1 rounded-md px-2 py-2.5 text-center ring-1 ring-black/5 transition hover:bg-linen-hover hover:ring-accent/30"
                >
                  <entry.icon className="size-4 text-stone" />
                  <span className="text-[11px] font-medium leading-tight text-ink">
                    {entry.label}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
