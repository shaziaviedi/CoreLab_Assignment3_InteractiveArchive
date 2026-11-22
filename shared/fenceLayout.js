import { NOTE_ANCHORS, TREE_INSTALLATION } from "./memorialLayout.js";

// Fine, stable fence-local coordinates. No client-supplied world transforms.
export const FENCE_GRID = Object.freeze({ columns: 96, rows: 26, bottom: 0.32, step: 0.02 });
const tau = Math.PI * 2;
export function validFencePosition(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === 2 && Number.isInteger(value.column) && Number.isInteger(value.row) &&
    value.column >= 0 && value.column < FENCE_GRID.columns && value.row >= 0 && value.row < FENCE_GRID.rows;
}
export function fencePlacement(position) {
  if (!validFencePosition(position)) return null;
  const { column, row } = position;
  return { id: `fence-${column}-${row}`, fencePosition: { column, row },
    angle: column / FENCE_GRID.columns * tau, height: Number((FENCE_GRID.bottom + row * FENCE_GRID.step).toFixed(2)) };
}
export function placementFromId(id) {
  const legacy = NOTE_ANCHORS.indexOf(id);
  if (legacy >= 0) return { ...fencePlacement({ column: (legacy % 12) * 8, row: legacy < 12 ? 25 : 7 }), id };
  const match = /^fence-(\d+)-(\d+)$/.exec(id ?? "");
  return match ? fencePlacement({ column: Number(match[1]), row: Number(match[2]) }) : null;
}
export function notePlacement(note) {
  return note.fencePosition ? fencePlacement(note.fencePosition) : placementFromId(note.anchorId);
}
export function nearestFencePlacement(angle, height) {
  const column = ((Math.round(angle / tau * FENCE_GRID.columns) % FENCE_GRID.columns) + FENCE_GRID.columns) % FENCE_GRID.columns;
  const row = Math.max(0, Math.min(FENCE_GRID.rows - 1, Math.round((height - FENCE_GRID.bottom) / FENCE_GRID.step)));
  return fencePlacement({ column, row });
}
export function notesOverlap(a, b) {
  const first = notePlacement(a), second = notePlacement(b);
  if (!first || !second) return false;
  const delta = Math.abs(first.angle - second.angle);
  const arc = Math.min(delta, tau - delta) * TREE_INSTALLATION.radius;
  // Include the paper's slight breeze/settling envelope, not just its center.
  return arc < 0.15 && Math.abs(first.height - second.height) < 0.19;
}
