import assert from "node:assert/strict";
import { loadPoolGeometry } from "./helpers/poolGeometry.js";
import test from "node:test";
import * as THREE from "three";
import { POOL_VIEW_SIDES, measurePoolLayout, poolCameraPosition, poolCameraTarget, treeCameraPosition, clearTreeOrbit, sideIndex, transitionPosition, safeCameraPosition } from "../../src/scene/navigation.js";
import { NORTH_POOL, POOL_SCALE, SURVIVOR_TREE, CAMERA_PRESETS, OVERVIEW } from "../../src/scene/memorialLayout.js";
import { canActivate } from "../../src/scene/useInteractionMode.js";

const layout = measurePoolLayout(loadPoolGeometry());

test("actual scaled parapet provides all 48 anchor surfaces", () => {
  assert.equal(layout.anchors.length, 48);
  assert.equal(new Set(layout.anchors.map((anchor) => anchor.id)).size, 48);
  assert.ok(Math.abs(layout.center.x - NORTH_POOL[0]) < 0.01);
  assert.ok(layout.bounds.max.x - layout.bounds.min.x > 11);
  for (const anchor of layout.anchors) {
    const [x, y, z] = anchor.position;
    assert.ok(x >= layout.bounds.min.x && x <= layout.bounds.max.x);
    assert.ok(z >= layout.bounds.min.z && z <= layout.bounds.max.z);
    assert.ok(y >= layout.bounds.min.y - 0.001 && y <= layout.bounds.max.y + 0.001);
  }
});

test("all pool side transitions, including wraps, remain outside the basin", () => {
  for (let step = -4; step <= 4; step++) {
    for (const direction of [-1, 1]) {
      for (let frame = 0; frame <= 100; frame++) {
        const position = poolCameraPosition(layout, step + direction * frame / 100);
        assert.ok(position.x < layout.bounds.min.x - 0.5 ||
          position.x > layout.bounds.max.x + 0.5 ||
          position.z < layout.bounds.min.z - 0.5 || position.z > layout.bounds.max.z + 0.5);
      }
    }
  }
  assert.equal(sideIndex(-1), 3);
  assert.equal(sideIndex(4), 0);
  assert.ok(poolCameraPosition(layout, 0).distanceTo(poolCameraPosition(layout, 4)) < 1e-10);
});

test("tree orbit covers every angle close to the trunk and transfers preserve every view", () => {
  for (let angle = -Math.PI * 4; angle <= Math.PI * 4; angle += 0.1) {
    assert.ok(treeCameraPosition(angle).distanceTo(treeCameraPosition(angle + Math.PI * 2)) < 1e-10);
    const position = treeCameraPosition(angle);
    assert.ok(Math.abs(Math.hypot(position.x - SURVIVOR_TREE[0], position.z - SURVIVOR_TREE[2]) - 3.2) < 1e-10);
    assert.equal(position.y, 1.05);
  }
  const views = [OVERVIEW.pos, ...Object.values(CAMERA_PRESETS).map((view) => view.pos),
    treeCameraPosition(0).toArray(), ...[0, 1, 2, 3].map((side) => poolCameraPosition(layout, side).toArray())];
  for (const start of views) for (const end of views) {
    const out = new THREE.Vector3();
    transitionPosition(new THREE.Vector3(...start), new THREE.Vector3(...end), 0, [], out);
    assert.ok(out.distanceTo(new THREE.Vector3(...start)) < 1e-10);
    transitionPosition(new THREE.Vector3(...start), new THREE.Vector3(...end), 1, [], out);
    assert.ok(out.distanceTo(new THREE.Vector3(...end)) < 1e-10);
  }
  assert.ok(treeCameraPosition(0).distanceTo(new THREE.Vector3(...SURVIVOR_TREE)) < 4);
});

test("each pool view frames its central parapet preview anchors", () => {
  for (let side = 0; side < 4; side++) {
    const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 280);
    camera.position.copy(poolCameraPosition(layout, side));
    camera.lookAt(poolCameraTarget(layout, side));
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const central = layout.anchors.filter((anchor) => anchor.poolSide === POOL_VIEW_SIDES[side]).slice(4, 8);
    for (const anchor of central)
      assert.ok(frustum.containsPoint(new THREE.Vector3(...anchor.position)), anchor.id);
  }
});

test("collision clearance and gesture ownership prevent clipping and accidental clicks", () => {
  const box = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 5, 1));
  const position = safeCameraPosition(new THREE.Vector3(0, 2, 0), [box]);
  assert.ok(position.y > box.max.y);
  const gesture = { ready: true, dragged: false, pointers: 0, fragmentDragging: false };
  assert.equal(canActivate(gesture, { button: 0, delta: 0 }), true);
  for (const blocked of [{ ready: false }, { dragged: true }, { pointers: 2 }, { fragmentDragging: true }])
    assert.equal(canActivate({ ...gesture, ...blocked }, { button: 0, delta: 0 }), false);
  assert.equal(canActivate(gesture, { button: 0, delta: 20 }), false);
  assert.equal(canActivate(gesture, { button: 2, delta: 0 }), false);
});


test("tree orbit avoids nearby trunks without rising into the canopy", () => {
  const blocker = new THREE.Box3(new THREE.Vector3(-3.35, 0, 12.6), new THREE.Vector3(-2.65, 2.6, 13.3));
  const position = treeCameraPosition(0.5);
  const cleared = clearTreeOrbit(position, [blocker]);
  assert.equal(cleared.y, 1.05);
  assert.ok(cleared.z < blocker.min.z - 0.2);
  assert.equal(blocker.containsPoint(cleared), false);
  for (let angle = 0; angle < Math.PI * 2; angle += 0.05)
    assert.ok(treeCameraPosition(angle, new THREE.Vector3(), 100).x < 0.83, "Zoom must remain outside the South Pool's west edge");
});

test("pool arrows follow the viewer's screen-right/left tangent on every side and wrap", () => {
  for (let step = -4; step <= 8; step++) {
    const position = poolCameraPosition(layout, step);
    const forward = poolCameraTarget(layout, step).sub(position).normalize();
    const right = forward.cross(new THREE.Vector3(0, 1, 0)).normalize();
    assert.ok(poolCameraPosition(layout, step + 0.01).sub(position).dot(right) > 0);
    assert.ok(poolCameraPosition(layout, step - 0.01).sub(position).dot(right) < 0);
    const side = POOL_VIEW_SIDES[sideIndex(step)];
    const relative = position.clone().sub(layout.center);
    assert.ok(side === "north" ? relative.z < 0 : side === "south" ? relative.z > 0 : side === "west" ? relative.x < 0 : relative.x > 0);
  }
});
