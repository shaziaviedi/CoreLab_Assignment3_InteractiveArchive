import { Box3, Vector3 } from "three";
import { NORTH_POOL, SOUTH_POOL, SURVIVOR_TREE } from "../../scene/memorialLayout.js";

export const MAX_VISIBLE_PEERS = 24;
// Keep the 3D scene quiet in busy rooms; the accessible list still includes everyone.
export function peerVisitors(visitors, visitorId) {
  return visitors.filter((visitor) => visitor.visitorId !== visitorId)
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.socketId.localeCompare(b.socketId))
    .slice(0, MAX_VISIBLE_PEERS);
}
export function visitorSeed(id) {
  return [...id].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
}
export function landmarkBounds(layout) {
  const north = layout?.bounds ?? new Box3(new Vector3(-12, 0, -15.35), new Vector3(-0.84, 0.33, -4.49));
  const offset = new Vector3(...SOUTH_POOL).sub(new Vector3(...NORTH_POOL));
  return [north.clone().expandByScalar(0.5), north.clone().translate(offset).expandByScalar(0.5)];
}
function candidates(zone, layout) {
  const bounds = layout?.bounds ?? new Box3(new Vector3(-12, 0, -15.35), new Vector3(-0.84, 0.33, -4.49));
  const result = [];
  for (let i = 0; i < 96; i++) {
    if (zone === "tree") {
      const angle = i % 16 * Math.PI / 8;
      const radius = 2.35 + Math.floor(i / 16) * 0.85;
      result.push([SURVIVOR_TREE[0] + Math.sin(angle) * radius, 0.01, SURVIVOR_TREE[2] + Math.cos(angle) * radius]);
    } else if (zone === "north") {
      const side = i % 4, station = Math.floor(i / 4) % 8;
      const t = 0.15 + station * 0.1, outward = 0.85 + Math.floor(i / 32) * 0.8;
      const x = side === 1 ? bounds.max.x + outward : side === 3 ? bounds.min.x - outward : bounds.min.x + t * (bounds.max.x - bounds.min.x);
      const z = side === 0 ? bounds.min.z - outward : side === 2 ? bounds.max.z + outward : bounds.min.z + t * (bounds.max.z - bounds.min.z);
      result.push([x, 0.01, z]);
    } else {
      const column = i % 6, row = Math.floor(i / 6);
      result.push([zone === "street" ? 20.2 + column * 0.7 : 13.4 + column * 0.7, 0.04, 3 + row * 0.85]);
    }
  }
  return result;
}

export function assignPresencePositions(peers, layout, obstacles = []) {
  // Presence is zone-based. Never transmit camera transforms or walk across a landmark.
  const pools = landmarkBounds(layout);
  const occupied = [];
  const assigned = new Map();
  for (const visitor of peers) {
    const point = candidates(visitor.currentZone, layout).find(([x, y, z]) => {
      if (Math.hypot(x - SURVIVOR_TREE[0], z - SURVIVOR_TREE[2]) < 1.95) return false;
      if (pools.some((box) => x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z)) return false;
      if (obstacles.some((box) => box.max.y > y + 0.1 && x > box.min.x - 0.25 && x < box.max.x + 0.25 && z > box.min.z - 0.25 && z < box.max.z + 0.25)) return false;
      return occupied.every((other) => Math.hypot(x - other[0], z - other[2]) >= 0.7);
    });
    if (point) { assigned.set(visitor.socketId, point); occupied.push(point); }
  }
  return assigned;
}
