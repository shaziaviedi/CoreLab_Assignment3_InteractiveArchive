import { Frustum, Matrix4, Sphere, Vector3 } from "three";

const cameras = new WeakMap();
const sphere = new Sphere(new Vector3(), 0.8);

export function visitorInView(camera, frameTime, position) {
  let entry = cameras.get(camera);
  if (!entry) {
    entry = { frame: -1, frustum: new Frustum(), matrix: new Matrix4() };
    cameras.set(camera, entry);
  }
  if (entry.frame !== frameTime) {
    entry.frame = frameTime;
    entry.frustum.setFromProjectionMatrix(entry.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  sphere.center.copy(position);
  sphere.center.y += 0.42;
  return entry.frustum.intersectsSphere(sphere);
}
