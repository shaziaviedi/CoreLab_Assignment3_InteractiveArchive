import { Ray, Vector3 } from "three";
const point = new Vector3(), direction = new Vector3(), hit = new Vector3();
const ray = new Ray();

export function projectPresence(position, camera, width, height, obstacles = []) {
  direction.copy(position).sub(camera.position);
  const distance = direction.length();
  ray.set(camera.position, direction.normalize());
  if (obstacles.some((box) => ray.intersectBox(box, hit) && hit.distanceTo(camera.position) < distance - 0.3)) return null;
  point.copy(position).project(camera);
  if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 0.96 || Math.abs(point.y) > 0.94) return null;
  return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
}
