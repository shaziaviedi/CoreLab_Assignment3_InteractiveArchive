// Runtime GLBs are embedded assets; original models remain untouched as backups.
export const ESSENTIAL_MODELS = Object.freeze([
  "reference-pool", "reference-museum", "survivor-sakura", "jabami-bush",
  "jabami-tree-v1", "jabami-tree-v4", "oculus", "city-lowpoly", "city-newyork",
  "one-world-trade-center",
]);
export const VISITOR_MODELS = Object.freeze(["male-idle", "female-idle", "male-walk", "female-walk"]);
export const PUBLIC_ASSETS = Object.freeze([
  ...[...ESSENTIAL_MODELS, ...VISITOR_MODELS].map((name) => `models/optimized/${name}.glb`),
  "favicon.svg", ...["eye", "moon", "sun", "tree", "street", "north"].map((name) => `svg/${name}.svg`),
]);
