import { Raycaster, Vector2, Vector3 } from "three";
import { nearestFencePlacement } from "../../../shared/fenceLayout.js";
import { noteAnchor, NOTE_CENTER_OFFSET, TAG_SCALE } from "./treeNoteLayout.js";
export function createFencePicker() {
  const ray = new Raycaster(),
    pointer = new Vector2(),
    local = new Vector3();
  return (event, camera, canvas, surface, installation) => {
    if (!surface || !installation) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    // Pointer events may arrive between render frames after an orbit change.
    camera.updateMatrixWorld(true);
    surface.updateWorldMatrix(true, false);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) return null;
    local.copy(hit.point);
    installation.worldToLocal(local);
    const placement = nearestFencePlacement(Math.atan2(local.x, local.z), local.y);
    return noteAnchor({
      fencePosition: placement.fencePosition
    });
  };
}
export function noteReadingFrame(note, position = new Vector3(), target = new Vector3(), aspect = 1.6, height = 800) {
  const anchor = noteAnchor(note);
  if (!anchor) return null;
  target.fromArray(anchor.position);
  target.y -= NOTE_CENTER_OFFSET;
  // Reserve screen space for presence, contributor metadata and the reader actions.
  const paperHeight = Math.max(60, Math.min(height * 0.45, height - 380));
  const distance = Math.max(0.4, 0.075 / (Math.tan(Math.PI * 16 / 180) * aspect), 0.18 * height / (2 * Math.tan(Math.PI * 16 / 180) * paperHeight));
  position.copy(target).add(new Vector3(Math.sin(anchor.angle) * distance, 0.015, Math.cos(anchor.angle) * distance));
  return {
    position,
    target
  };
}
export function projectNoteBounds(note, camera, width, height) {
  const anchor = noteAnchor(note);
  if (!anchor) return null;
  camera.updateMatrixWorld(true);
  const points = [];
  // Include paper curl, hanging loop and the small animated sway envelope.
  for (const x of [-0.20, 0.20]) for (const y of [0.025, -0.49]) for (const z of [-0.025, 0.055]) {
    const p = new Vector3(x, y, z).multiplyScalar(TAG_SCALE).applyAxisAngle(new Vector3(0, 1, 0), anchor.angle).add(new Vector3(...anchor.position)).project(camera);
    if (p.z < -1 || p.z > 1) return null;
    points.push({
      x: (p.x + 1) * width / 2,
      y: (1 - p.y) * height / 2
    });
  }
  return {
    left: Math.min(...points.map(p => p.x)),
    right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)),
    bottom: Math.max(...points.map(p => p.y))
  };
}
export function noteMetadataPosition(bounds, width, height, cardWidth = 220, cardHeight = 64) {
  const edge = 16,
    gap = 20;
  const y = Math.max(edge, Math.min(height - 90 - cardHeight, Math.max(260, (bounds.top + bounds.bottom - cardHeight) / 2)));
  if (bounds.left - gap - cardWidth >= edge) return {
    x: bounds.left - gap - cardWidth,
    y
  };
  if (bounds.right + gap + cardWidth <= width - edge) return {
    x: bounds.right + gap,
    y
  };
  return {
    x: Math.max(edge, (width - cardWidth) / 2),
    y: height - 90 - cardHeight
  };
}
export function projectNote(note, camera, width, height) {
  const anchor = noteAnchor(note);
  if (!anchor) return null;
  camera.updateMatrixWorld(true);
  const point = new Vector3(...anchor.position);
  point.y -= NOTE_CENTER_OFFSET;
  point.project(camera);
  if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 0.98 || Math.abs(point.y) > 0.98) return null;
  return {
    x: (point.x + 1) * width / 2,
    y: (1 - point.y) * height / 2
  };
}
