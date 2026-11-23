import { Raycaster, Vector2, Vector3 } from "three";
import { nearestFencePlacement } from "../../../shared/fenceLayout.js";
import { noteAnchor, NOTE_CENTER_OFFSET } from "./treeNoteLayout.js";

export function createFencePicker() {
  const ray = new Raycaster(), pointer = new Vector2(), local = new Vector3();
  return (event, camera, canvas, surface, installation) => {
    if (!surface || !installation) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      1 - (event.clientY - rect.top) / rect.height * 2);
    // Pointer events may arrive between render frames after an orbit change.
    camera.updateMatrixWorld(true);
    surface.updateWorldMatrix(true, false);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) return null;
    local.copy(hit.point);
    installation.worldToLocal(local);
    const placement = nearestFencePlacement(Math.atan2(local.x, local.z), local.y);
    return noteAnchor({ fencePosition: placement.fencePosition });
  };
}

export function noteReadingFrame(note, position = new Vector3(), target = new Vector3(), aspect = 1.6) {
  const anchor = noteAnchor(note);
  if (!anchor) return null;
  target.fromArray(anchor.position);
  target.y -= NOTE_CENTER_OFFSET;
  const distance = Math.max(0.4, 0.075 / (Math.tan(Math.PI * 16 / 180) * aspect));
  position.copy(target).add(new Vector3(Math.sin(anchor.angle) * distance, 0.015, Math.cos(anchor.angle) * distance));
  return { position, target };
}

export function projectNote(note, camera, width, height) {
  const anchor = noteAnchor(note);
  if (!anchor) return null;
  camera.updateMatrixWorld(true);
  const point = new Vector3(...anchor.position);
  point.y -= NOTE_CENTER_OFFSET;
  point.project(camera);
  if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 0.98 || Math.abs(point.y) > 0.98) return null;
  return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
}
