// Geometry for drag-to-reorder lists. Pure, so it's tested without a DOM.

/**
 * Where a dragged row lands: past every row whose centre its own centre has
 * crossed. `centers` are the rows' resting centres, in order.
 */
export function reorderTarget(centers: readonly number[], from: number, draggedCenter: number): number {
  let to = from;
  while (to < centers.length - 1 && draggedCenter > centers[to + 1]) to++;
  while (to > 0 && draggedCenter < centers[to - 1]) to--;
  return to;
}

/** How far row `i` slides to make room while row `from` hovers over slot `to`. */
export function makeRoomOffset(i: number, from: number, to: number, draggedHeight: number): number {
  if (i === from) return 0;
  if (from < to && i > from && i <= to) return -draggedHeight;
  if (from > to && i >= to && i < from) return draggedHeight;
  return 0;
}
