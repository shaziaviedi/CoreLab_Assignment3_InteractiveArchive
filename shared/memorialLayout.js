import { POOL_SIDES } from "./protocol.js";

export const LAYOUT_VERSION = 1;

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
