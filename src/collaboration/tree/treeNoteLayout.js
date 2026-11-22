import { NOTE_ANCHORS } from "../../../shared/memorialLayout.js";
import { SURVIVOR_TREE } from "../../scene/memorialLayout.js";

// Two attachment heights on twelve stations; IDs remain the server's stable IDs.
export const INSTALLATION_RADIUS = 1.35;
export const TREE_NOTE_ANCHORS = NOTE_ANCHORS.map((id, index) => {
  const angle = (index % 12) * Math.PI / 6;
  return Object.freeze({
    id, angle,
    position: [
      SURVIVOR_TREE[0] + Math.sin(angle) * INSTALLATION_RADIUS,
      index < 12 ? 1.22 : 0.81,
      SURVIVOR_TREE[2] + Math.cos(angle) * INSTALLATION_RADIUS,
    ],
  });
});
export const TREE_NOTE_BY_ID = new Map(TREE_NOTE_ANCHORS.map((anchor) => [anchor.id, anchor]));
export const noteLength = (text) => [...text].length;
export const limitNote = (text) => [...text].slice(0, 180).join("");

// Ignore the hidden backs of tags/anchors instead of clicking through the trunk.
export function anchorFacesCamera(anchor, position) {
  return (position.x - anchor.position[0]) * Math.sin(anchor.angle) +
    (position.z - anchor.position[2]) * Math.cos(anchor.angle) > 0;
}
