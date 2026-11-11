import { useRef, useState } from "react";
import type {
  Block,
  BlockKind,
  Column,
  Section,
  SitePage,
} from "@/types/website";
import type { MediaItem } from "@/types/media";
import type { SitePagePatch } from "@/lib/api/sites";
import type { ImportZipOutcome } from "@/hooks/useImportedMedia";
import { createLiveRenderContext } from "@/lib/websiteRender";
import {
  createDefaultBlock,
  createEmptySection,
  insertBlockIntoSections,
  moveBlockInSections,
  removeBlockFromSections,
  removeSectionFromSections,
  updateBlockInSections,
  updateColumnInSections,
  updateSectionInSections,
} from "@/lib/websiteBlocks";
import { findDropTarget, type ColumnDropRect } from "@/lib/dragReorder";
import {
  WebsitePageBlocks,
  type SelectedPath,
} from "@/components/WebsitePageBlocks";
import { BlockPalettePanel } from "@/components/BlockPalettePanel";
import { BlockStylePanel } from "@/components/BlockStylePanel";
import { PlusIcon } from "@/components/icons";

type Props = {
  page: SitePage;
  pages: SitePage[];
  mediaItems: MediaItem[];
  onChangePage: (patch: SitePagePatch) => void;
  onImportFiles: (files: File[]) => Promise<ImportZipOutcome>;
};

/** One open page: a block palette on the left, the live editing canvas in the middle
 * (the same WebsitePageBlocks renderer Preview/export use, with `interactive` set),
 * and a contextual style/content panel on the right — mirrors BookPageCanvas.tsx's
 * 3-pane shape one level deeper. */
export function SitePageCanvas({
  page,
  pages,
  mediaItems,
  onChangePage,
  onImportFiles,
}: Props) {
  const [selected, setSelected] = useState<SelectedPath | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const columnElsRef = useRef(new Map<string, HTMLElement>());
  const canvasRef = useRef<HTMLDivElement>(null);

  const ctx = createLiveRenderContext(pages);

  const collectColumnRects = (): ColumnDropRect[] => {
    const result: ColumnDropRect[] = [];
    columnElsRef.current.forEach((el, key) => {
      const sep = key.indexOf("::");
      const sectionId = key.slice(0, sep);
      const columnId = key.slice(sep + 2);
      const rect = el.getBoundingClientRect();
      const blockRects = Array.from(
        el.querySelectorAll<HTMLElement>(":scope > [data-block-id]"),
      ).map((be) => ({
        blockId: be.dataset.blockId as string,
        rect: be.getBoundingClientRect(),
      }));
      result.push({ sectionId, columnId, rect, blockRects });
    });
    return result;
  };

  const commitSections = (next: Section[]) => onChangePage({ sections: next });

  // Drag-to-add-from-palette: new territory (Books only has click-to-append buttons).
  // A floating ghost chip follows the pointer; the drop target is resolved from the
  // registered column rects via lib/dragReorder.ts, with one commit on release.
  const beginPaletteDrag = (kind: BlockKind, e: React.PointerEvent) => {
    e.preventDefault();
    const entryLabel = kind;
    setDragGhost({ label: entryLabel, x: e.clientX, y: e.clientY });
    let latestTarget: ReturnType<typeof findDropTarget> = null;

    const onMove = (ev: PointerEvent) => {
      setDragGhost({ label: entryLabel, x: ev.clientX, y: ev.clientY });
      const rects = collectColumnRects();
      latestTarget = findDropTarget(rects, ev.clientX, ev.clientY);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (latestTarget) {
        const block = createDefaultBlock(kind);
        commitSections(
          insertBlockIntoSections(
            page.sections,
            latestTarget.sectionId,
            latestTarget.columnId,
            latestTarget.index,
            block,
          ),
        );
        setSelected({
          scope: "block",
          sectionId: latestTarget.sectionId,
          columnId: latestTarget.columnId,
          blockId: block.id,
        });
      }
      setDragGhost(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Drag-to-reorder an existing block — same gesture shape, but the "ghost" is just a
  // label for the block being moved and the source location is removed on drop before
  // the new location is inserted (lib/websiteBlocks.ts's moveBlockInSections).
  const beginBlockDrag = (
    e: React.PointerEvent,
    sectionId: string,
    columnId: string,
    blockId: string,
  ) => {
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let latestTarget: ReturnType<typeof findDropTarget> = null;

    const onMove = (ev: PointerEvent) => {
      if (
        !dragging &&
        Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4
      ) {
        dragging = true;
        setDragGhost({ label: "Move block", x: ev.clientX, y: ev.clientY });
      }
      if (!dragging) return;
      setDragGhost({ label: "Move block", x: ev.clientX, y: ev.clientY });
      const rects = collectColumnRects();
      latestTarget = findDropTarget(rects, ev.clientX, ev.clientY);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (dragging && latestTarget) {
        commitSections(
          moveBlockInSections(
            page.sections,
            { sectionId, columnId, blockId },
            {
              sectionId: latestTarget.sectionId,
              columnId: latestTarget.columnId,
              index: latestTarget.index,
            },
          ),
        );
      }
      setDragGhost(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleAddSlotBlock = (slot: "header" | "hero" | "footer") => {
    const block = createDefaultBlock(slot);
    onChangePage({ [slot]: block } as SitePagePatch);
    setSelected({ scope: "slot", slot });
  };

  const handleAddSection = () => {
    commitSections([
      ...page.sections,
      createEmptySection(page.sections.length),
    ]);
  };

  const handleRemoveSelected = () => {
    if (!selected) return;
    if (selected.scope === "slot") {
      onChangePage({ [selected.slot]: null } as SitePagePatch);
    } else if (selected.scope === "section") {
      commitSections(
        removeSectionFromSections(page.sections, selected.sectionId),
      );
    } else if (selected.scope === "block") {
      commitSections(
        removeBlockFromSections(
          page.sections,
          selected.sectionId,
          selected.columnId,
          selected.blockId,
        ),
      );
    }
    setSelected(null);
  };

  const findBlock = (path: SelectedPath): Block | null => {
    if (path.scope === "slot") return page[path.slot];
    if (path.scope !== "block") return null;
    const section = page.sections.find((s) => s.id === path.sectionId);
    const column = section?.columns.find((c) => c.id === path.columnId);
    return column?.blocks.find((b) => b.id === path.blockId) ?? null;
  };

  const findColumn = (sectionId: string, columnId: string): Column | null => {
    const section = page.sections.find((s) => s.id === sectionId);
    return section?.columns.find((c) => c.id === columnId) ?? null;
  };

  const findSection = (sectionId: string): Section | null =>
    page.sections.find((s) => s.id === sectionId) ?? null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <BlockPalettePanel onStartDrag={beginPaletteDrag} />

      <div
        ref={canvasRef}
        className="flex-1 overflow-y-auto bg-canvas"
        onClick={() => setSelected(null)}
        onClickCapture={(e) => {
          // Prevent real navigation/submission while editing — anchors/submit buttons
          // inside WebsitePageBlocks are for the finished site, not this canvas.
          const target = e.target as HTMLElement;
          if (target.closest("a, button[type=submit], form"))
            e.preventDefault();
        }}
      >
        <div
          className="mx-auto max-w-5xl bg-white shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <WebsitePageBlocks
            page={page}
            ctx={ctx}
            interactive={{
              selected,
              onSelect: setSelected,
              onBlockPointerDown: beginBlockDrag,
              registerColumnEl: (sectionId, columnId, el) => {
                const key = `${sectionId}::${columnId}`;
                if (el) columnElsRef.current.set(key, el);
                else columnElsRef.current.delete(key);
              },
              onAddSlotBlock: handleAddSlotBlock,
            }}
          />
        </div>
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAddSection();
            }}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-stone ring-1 ring-linen transition hover:bg-linen-hover hover:text-ink"
          >
            <PlusIcon className="size-3.5" />
            Add section
          </button>
        </div>
      </div>

      <BlockStylePanel
        selected={selected}
        block={selected ? findBlock(selected) : null}
        column={
          selected &&
          (selected.scope === "column" || selected.scope === "block")
            ? findColumn(selected.sectionId, selected.columnId)
            : null
        }
        section={
          selected &&
          (selected.scope === "section" ||
            selected.scope === "column" ||
            selected.scope === "block")
            ? findSection(selected.sectionId)
            : null
        }
        pages={pages}
        mediaItems={mediaItems}
        onImportFiles={onImportFiles}
        onUpdateBlock={(next) => {
          if (!selected) return;
          if (selected.scope === "slot") {
            onChangePage({ [selected.slot]: next } as SitePagePatch);
          } else if (selected.scope === "block") {
            commitSections(
              updateBlockInSections(
                page.sections,
                selected.sectionId,
                selected.columnId,
                selected.blockId,
                next,
              ),
            );
          }
        }}
        onUpdateColumn={(patch) => {
          if (
            !selected ||
            (selected.scope !== "column" && selected.scope !== "block")
          )
            return;
          commitSections(
            updateColumnInSections(
              page.sections,
              selected.sectionId,
              selected.columnId,
              patch,
            ),
          );
        }}
        onUpdateSection={(patch) => {
          if (
            !selected ||
            (selected.scope !== "section" &&
              selected.scope !== "column" &&
              selected.scope !== "block")
          )
            return;
          commitSections(
            updateSectionInSections(page.sections, selected.sectionId, patch),
          );
        }}
        onRemoveSelected={handleRemoveSelected}
      />

      {dragGhost && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          {dragGhost.label}
        </div>
      )}
    </div>
  );
}
