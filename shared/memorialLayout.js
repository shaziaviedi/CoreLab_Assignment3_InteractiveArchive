import { POOL_SIDES } from "./protocol.js";

export const LAYOUT_VERSION = 4;

// Keep the installation and its attachment transforms identical across clients.
export const TREE_INSTALLATION = Object.freeze({
  radius: 0.85, upperHeight: 0.82, lowerHeight: 0.46,
  postHeight: 0.9, tagScale: 0.38, visitorClearance: 1.25, noteOffset: 0.027,
});

// Stable placement IDs shared by the server and scene.
export const NOTE_ANCHORS = Object.freeze(
  Array.from({ length: 24 }, (_, i) => `tree-${String(i + 1).padStart(2, "0")}`),
);

export const FLOWER_ANCHORS = Object.freeze(
  Object.fromEntries(
    POOL_SIDES.map((side) => [
      side,
      Object.freeze(
        Array.from(
          { length: 12 },
          (_, i) => `north-pool-${side}-${String(i + 1).padStart(2, "0")}`,
        ),
      ),
    ]),
  ),
);
