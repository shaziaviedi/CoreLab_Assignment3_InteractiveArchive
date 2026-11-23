import * as THREE from "three";
import { FLOWER_ANCHORS } from "../../shared/memorialLayout.js";
import { POOL_SIDES } from "../../shared/protocol.js";
import { SURVIVOR_TREE } from "./memorialLayout.js";

export const sideIndex = (step) => ((step % 4) + 4) % 4;
// The camera faces inward: its screen-right tangent opposes an outward map bearing.
export const POOL_VIEW_SIDES = Object.freeze(["north", "west", "south", "east"]);
export const TREE_ORBIT_RADIUS = 3.2;
export const ease = (t) => t * t * (3 - 2 * t);

export function measurePoolLayout(model) {
  model.updateWorldMatrix(true, true);
  const surfaces = [];
  model.traverse((node) => {
    if (node.isMesh && node.name === "pool-part-18") surfaces.push(node);
  });
  if (!surfaces.length) throw new Error("The pool parapet mesh is missing.");
  const bounds = new THREE.Box3();
  surfaces.forEach((mesh) => bounds.union(new THREE.Box3().setFromObject(mesh)));
  const center = bounds.getCenter(new THREE.Vector3());
  const ray = new THREE.Raycaster();
  const normalMatrix = new THREE.Matrix3();
  const tangents = { north: [1, 0, 0], east: [0, 0, 1], south: [-1, 0, 0], west: [0, 0, -1] };
  const anchors = [];
  POOL_SIDES.forEach((side) => {
    FLOWER_ANCHORS[side].forEach((id, index) => {
      // Reserve the inner panel for names. The entire narrow rose footprint
      // lies parallel to the edge in the narrow outer lip, clear of corners.
      const t = 0.1 + (index / 11) * 0.8;
      const x = side === "east" ? bounds.max.x - 0.075 :
        side === "west" ? bounds.min.x + 0.075 :
          THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, t);
      const z = side === "north" ? bounds.min.z + 0.075 :
        side === "south" ? bounds.max.z - 0.075 :
          THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, t);
      ray.set(new THREE.Vector3(x, bounds.max.y + 1, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(surfaces, false)[0];
      if (hit) {
        const normal = hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
        if (normal.y < 0) normal.negate();
        const tangent = new THREE.Vector3(...tangents[side]);
        tangent.addScaledVector(normal, -tangent.dot(normal)).normalize();
        const across = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, normal, across));
        anchors.push({ id, poolSide: side, position: hit.point.toArray(), quaternion: rotation.toArray() });
      }
    });
  });
  return { bounds, center, anchors };
}

export function poolCameraPosition(layout, step, out = new THREE.Vector3()) {
  const angle = -step * Math.PI / 2;
  const sin = Math.sin(angle), cos = Math.cos(angle);
  // A rounded square keeps the whole path outside the basin, including corners.
  const scale = Math.pow(Math.abs(sin) ** 8 + Math.abs(cos) ** 8, -1 / 8);
  const rx = (layout.bounds.max.x - layout.bounds.min.x) / 2 + 1.8;
  const rz = (layout.bounds.max.z - layout.bounds.min.z) / 2 + 1.8;
  return out.set(
    layout.center.x + sin * scale * rx,
    layout.bounds.max.y + 3,
    layout.center.z - cos * scale * rz,
  );
}

export function poolCameraTarget(layout, step, out = new THREE.Vector3()) {
  // Look toward the near parapet so placement previews stay inside the frame.
  poolCameraPosition(layout, step, out);
  out.sub(layout.center).multiplyScalar(0.55).add(layout.center);
  out.y = layout.bounds.max.y - 0.15;
  return out;
}

export function treeCameraPosition(angle, out = new THREE.Vector3(), radius = TREE_ORBIT_RADIUS) {
  const bearing = -0.5 + angle;
  const distance = THREE.MathUtils.clamp(radius, 2.6, 3.5);
  return out.set(
    SURVIVOR_TREE[0] + Math.sin(bearing) * distance,
    1.05,
    SURVIVOR_TREE[2] + Math.cos(bearing) * distance,
  );
}

export function treeTransitionPosition(start, end, progress, out) {
  const t = ease(progress);
  const a = Math.atan2(start.x - SURVIVOR_TREE[0], start.z - SURVIVOR_TREE[2]);
  const b = Math.atan2(end.x - SURVIVOR_TREE[0], end.z - SURVIVOR_TREE[2]);
  const angle = a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  const radius = THREE.MathUtils.lerp(Math.hypot(start.x - SURVIVOR_TREE[0], start.z - SURVIVOR_TREE[2]),
    Math.hypot(end.x - SURVIVOR_TREE[0], end.z - SURVIVOR_TREE[2]), t);
  return out.set(SURVIVOR_TREE[0] + Math.sin(angle) * radius,
    THREE.MathUtils.lerp(start.y, end.y, t), SURVIVOR_TREE[2] + Math.cos(angle) * radius);
}

const treeRay = new THREE.Ray();
const treeHit = new THREE.Vector3();

export function clearTreeOrbit(position, obstacles) {
  treeRay.origin.set(SURVIVOR_TREE[0], position.y, SURVIVOR_TREE[2]);
  const distance = position.distanceTo(treeRay.origin);
  treeRay.direction.copy(position).sub(treeRay.origin).normalize();
  let radius = distance;
  for (const box of obstacles) {
    // The orbit's minimum radius already protects the Survivor Tree trunk.
    if (box.containsPoint(treeRay.origin)) continue;
    if (treeRay.intersectBox(box, treeHit))
      radius = Math.min(radius, Math.max(1.9, treeHit.distanceTo(treeRay.origin) - 0.25));
  }
  return position.copy(treeRay.origin).addScaledVector(treeRay.direction, radius);
}

export function safeCameraPosition(position, obstacles) {
  for (const box of obstacles) {
    if (position.x >= box.min.x && position.x <= box.max.x &&
      position.z >= box.min.z && position.z <= box.max.z &&
      position.y >= box.min.y && position.y < box.max.y + 0.4)
      position.y = box.max.y + 0.4;
  }
  return position;
}

export function transitionPosition(start, end, progress, obstacles, out) {
  const t = ease(progress);
  let lift = Math.max(start.y, end.y);
  // Lift over planting along the transfer corridor before descending to the view.
  for (const box of obstacles) {
    if (box.max.x >= Math.min(start.x, end.x) - 0.4 &&
      box.min.x <= Math.max(start.x, end.x) + 0.4 &&
      box.max.z >= Math.min(start.z, end.z) - 0.4 &&
      box.min.z <= Math.max(start.z, end.z) + 0.4)
      lift = Math.max(lift, box.max.y + 1);
  }
  out.lerpVectors(start, end, t);
  out.y = (1 - t) ** 3 * start.y + 3 * (1 - t) ** 2 * t * lift +
    3 * (1 - t) * t ** 2 * lift + t ** 3 * end.y;
  return safeCameraPosition(out, obstacles);
}
