import { Quaternion, Vector3 } from "three";

const projected = new Vector3();
const orientation = new Quaternion();
export function projectFlower(anchor, camera, width, height) {
  // Follow the bloom, including the measured slope of this particular side.
  projected.set(0.128, 0.055, 0);
  if (anchor.quaternion) projected.applyQuaternion(orientation.fromArray(anchor.quaternion));
  projected.x += anchor.position[0];
  projected.y += anchor.position[1];
  projected.z += anchor.position[2];
  projected.project(camera);
  if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 0.98 || Math.abs(projected.y) > 0.95) return null;
  return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2 };
}

export function formatFlowerTime(createdAt) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(createdAt));
}
