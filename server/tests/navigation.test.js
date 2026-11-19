import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { measurePoolLayout, poolCameraPosition, poolCameraTarget, treeCameraPosition, sideIndex, transitionPosition, safeCameraPosition } from "../../src/scene/navigation.js";
import { NORTH_POOL, POOL_SCALE, SURVIVOR_TREE, CAMERA_PRESETS, OVERVIEW } from "../../src/scene/memorialLayout.js";
import { canActivate } from "../../src/scene/useInteractionMode.js";

// Decode only mesh positions and indices; the real GLB supplies all test geometry.
function loadPoolGeometry() {
  const bytes = readFileSync(new URL("../../public/models/reference-pool.glb", import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const types = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  function attribute(index) {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    const width = accessor.type === "VEC3" ? 3 : 1;
    const Type = types[accessor.componentType];
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = new Type(accessor.count * width);
    const stride = view.byteStride ?? width * Type.BYTES_PER_ELEMENT;
    const read = accessor.componentType === 5126 ? "readFloatLE" :
      accessor.componentType === 5125 ? "readUInt32LE" : "readUInt16LE";
    for (let vertex = 0; vertex < accessor.count; vertex++)
      for (let component = 0; component < width; component++)
        values[vertex * width + component] = bytes[read](start + vertex * stride + component * Type.BYTES_PER_ELEMENT);
    return new THREE.BufferAttribute(values, width);
  }
  function node(index) {
    const source = gltf.nodes[index];
    const group = new THREE.Group();
    if (source.matrix) group.applyMatrix4(new THREE.Matrix4().fromArray(source.matrix));
    else {
      group.position.fromArray(source.translation ?? [0, 0, 0]);
      group.quaternion.fromArray(source.rotation ?? [0, 0, 0, 1]);
      group.scale.fromArray(source.scale ?? [1, 1, 1]);
    }
    if (source.mesh !== undefined) {
      for (const primitive of gltf.meshes[source.mesh].primitives) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", attribute(primitive.attributes.POSITION));
        if (primitive.indices !== undefined) geometry.setIndex(attribute(primitive.indices));
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
        mesh.name = source.name;
        group.add(mesh);
      }
    }
    (source.children ?? []).forEach((child) => group.add(node(child)));
    return group;
  }
  const root = new THREE.Group();
  root.position.fromArray(NORTH_POOL);
  root.scale.setScalar(POOL_SCALE);
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((index) => root.add(node(index)));
  return root;
}

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

test("tree orbit stays bounded and transfer endpoints preserve every view", () => {
  assert.deepEqual(treeCameraPosition(-100).toArray(), treeCameraPosition(-0.32).toArray());
  assert.deepEqual(treeCameraPosition(100).toArray(), treeCameraPosition(0.32).toArray());
  const views = [OVERVIEW.pos, ...Object.values(CAMERA_PRESETS).map((view) => view.pos),
    treeCameraPosition(0).toArray(), ...[0, 1, 2, 3].map((side) => poolCameraPosition(layout, side).toArray())];
  for (const start of views) for (const end of views) {
    const out = new THREE.Vector3();
    transitionPosition(new THREE.Vector3(...start), new THREE.Vector3(...end), 0, [], out);
    assert.ok(out.distanceTo(new THREE.Vector3(...start)) < 1e-10);
    transitionPosition(new THREE.Vector3(...start), new THREE.Vector3(...end), 1, [], out);
    assert.ok(out.distanceTo(new THREE.Vector3(...end)) < 1e-10);
  }
  assert.ok(treeCameraPosition(0).distanceTo(new THREE.Vector3(...SURVIVOR_TREE)) > 7);
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
    const central = layout.anchors.slice(side * 12 + 4, side * 12 + 8);
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
