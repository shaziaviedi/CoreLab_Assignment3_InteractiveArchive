import { NOTE_ANCHORS, TREE_INSTALLATION } from "../../../shared/memorialLayout.js";
import { fencePlacement, notePlacement } from "../../../shared/fenceLayout.js";
import { SURVIVOR_TREE } from "../../scene/memorialLayout.js";

export const INSTALLATION_RADIUS = TREE_INSTALLATION.radius;
export const INSTALLATION_HEIGHTS = [TREE_INSTALLATION.lowerHeight, TREE_INSTALLATION.upperHeight];
export const TAG_SCALE = TREE_INSTALLATION.tagScale;
export const NOTE_CENTER_OFFSET = 0.245 * TAG_SCALE;
export function noteAnchor(note) {
  const placement = notePlacement(note);
  return placement && { ...placement, position: [
    SURVIVOR_TREE[0] + Math.sin(placement.angle) * INSTALLATION_RADIUS,
    SURVIVOR_TREE[1] + placement.height,
    SURVIVOR_TREE[2] + Math.cos(placement.angle) * INSTALLATION_RADIUS,
  ] };
}
// Legacy IDs still resolve exactly; keyboard navigation uses a manageable subset
// of the fine surface grid rather than thousands of focus stops.
export const TREE_NOTE_ANCHORS = NOTE_ANCHORS.map((anchorId) => ({ ...noteAnchor({ anchorId }), id: anchorId }));
export const TREE_NOTE_BY_ID = new Map(TREE_NOTE_ANCHORS.map((anchor) => [anchor.id, anchor]));
export const KEYBOARD_NOTE_ANCHORS = Array.from({ length: 96 }, (_, index) => {
  const placement = fencePlacement({ column: (index % 32) * 3, row: [0, 12, 25][Math.floor(index / 32)] });
  return noteAnchor({ fencePosition: placement.fencePosition });
});
export const noteLength = (text) => [...text].length;
export const limitNote = (text) => [...text].slice(0, 180).join("");

export function anchorFacesCamera(anchor, position) {
  return (position.x - anchor.position[0]) * Math.sin(anchor.angle) +
    (position.z - anchor.position[2]) * Math.cos(anchor.angle) > 0;
}
