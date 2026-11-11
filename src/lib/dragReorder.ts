export interface ColumnDropRect {
  sectionId: string;
  columnId: string;
  rect: DOMRect;
  blockRects: { blockId: string; rect: DOMRect }[];
}

export interface DropTarget {
  sectionId: string;
  columnId: string;
  index: number;
}

/**
 * Pure, DOM-access-free hit-testing shared by drag-to-add-from-palette and
 * drag-to-reorder-blocks (new territory — Books only ever needed free x/y placement,
 * never list reordering). Finds the column under the pointer (falling back to the
 * horizontally-nearest one so a drop near a column's edge doesn't fail), then the
 * insertion index within it from the pointer's vertical position among that column's
 * block rects.
 */
export function findDropTarget(
  columns: ColumnDropRect[],
  pointerX: number,
  pointerY: number,
): DropTarget | null {
  if (columns.length === 0) return null;

  let best: ColumnDropRect | null = null;
  let bestDistance = Infinity;
  for (const col of columns) {
    const { rect } = col;
    const withinY = pointerY >= rect.top && pointerY <= rect.bottom;
    const dx =
      pointerX < rect.left
        ? rect.left - pointerX
        : pointerX > rect.right
          ? pointerX - rect.right
          : 0;
    // Strongly prefer a column whose row the pointer is actually in; otherwise fall
    // back to the horizontally-nearest one so a drop near an edge doesn't just fail.
    const distance = withinY ? dx : dx + 100000;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = col;
    }
  }
  if (!best) return null;

  let index = best.blockRects.length;
  for (let i = 0; i < best.blockRects.length; i++) {
    const mid =
      best.blockRects[i].rect.top + best.blockRects[i].rect.height / 2;
    if (pointerY < mid) {
      index = i;
      break;
    }
  }
  return { sectionId: best.sectionId, columnId: best.columnId, index };
}
