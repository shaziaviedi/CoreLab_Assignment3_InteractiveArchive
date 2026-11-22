import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { io } from "socket.io-client";
import { createMemorialServer } from "../app.js";
import { readConfig } from "../config.js";
import { validateContribution } from "../validation.js";
import { fencePlacement, nearestFencePlacement, notesOverlap } from "../../shared/fenceLayout.js";
import { ROSE_COLORS } from "../../shared/protocol.js";
import { TREE_INSTALLATION } from "../../shared/memorialLayout.js";
import { noteAnchor, KEYBOARD_NOTE_ANCHORS, TAG_SCALE } from "../../src/collaboration/tree/treeNoteLayout.js";
import useTreeNotes from "../../src/collaboration/tree/useTreeNotes.js";
import usePoolFlowers from "../../src/collaboration/flowers/usePoolFlowers.js";
import { roseRestingTransform } from "../../src/collaboration/flowers/roseAppearance.js";
import { createRoseResources } from "../../src/collaboration/flowers/roseGeometry.js";
import { treeTrunkCenter } from "../../src/scene/treeAlignment.js";
import { loadGeometry, loadPoolGeometry } from "./helpers/poolGeometry.js";
import { measurePoolLayout, treeCameraPosition } from "../../src/scene/navigation.js";
import { SURVIVOR_TREE } from "../../src/scene/memorialLayout.js";
import FlowerOverlay from "../../src/collaboration/flowers/FlowerOverlay.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const notePayload = (column, row) => ({ requestId: randomUUID(), text: "Remembered together.", fencePosition: { column, row } });

test("fine fence positions validate bounds, preserve legacy attachments and reject world transforms", () => {
  for (const column of [0, 1, 47, 95]) for (const row of [0, 12, 25]) {
    const input = validateContribution("note", notePayload(column, row));
    assert.deepEqual(input.fencePosition, { column, row });
    const anchor = noteAnchor(input);
    assert.ok(Math.abs(Math.hypot(anchor.position[0] - SURVIVOR_TREE[0], anchor.position[2] - SURVIVOR_TREE[2]) - TREE_INSTALLATION.radius) < 1e-10);
    assert.ok(anchor.position[1] - 0.46 * TAG_SCALE > 0.1);
    assert.deepEqual(nearestFencePlacement(anchor.angle, anchor.height).fencePosition, input.fencePosition);
  }
  for (const fencePosition of [null, {}, { column: -1, row: 0 }, { column: 96, row: 0 }, { column: 1, row: 26 }, { column: 1.5, row: 2 }, { column: 1, row: 2, x: 0 }])
    assert.throws(() => validateContribution("note", { ...notePayload(1, 1), fencePosition }));
  assert.throws(() => validateContribution("note", { ...notePayload(1, 1), anchorId: "tree-01" }));
  assert.throws(() => validateContribution("note", { ...notePayload(1, 1), position: [0, 0, 0] }));
  const legacy = validateContribution("note", { requestId: "legacy", text: "Older note", anchorId: "tree-01" });
  assert.equal(legacy.anchorId, "tree-01");
  assert.deepEqual(noteAnchor(legacy).position, noteAnchor({ anchorId: "tree-01" }).position);
  assert.ok(notesOverlap(legacy, { fencePosition: { column: 95, row: 25 } }), "collision wraps around the cylinder seam");
  assert.equal(KEYBOARD_NOTE_ANCHORS.length, 96);
});

test("independent clients synchronize fence coordinates/colors, resolve neighboring collisions and restore snapshots", async (t) => {
  const server = createMemorialServer(readConfig({ CONTRIBUTION_LIMIT: "100" }));
  const sockets = [];
  t.after(async () => { sockets.forEach((socket) => socket.disconnect()); await new Promise((resolve) => server.io.close(resolve)); });
  server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  async function client(name) {
    const socket = io(`http://127.0.0.1:${server.httpServer.address().port}`, { forceNew: true, reconnection: false });
    sockets.push(socket); await once(socket, "connect");
    const joined = await socket.emitWithAck("room:join", { roomId: "new-placement", visitorId: randomUUID(), username: name, avatarType: name === "A" ? "male" : "female" });
    assert.equal(joined.ok, true);
    return socket;
  }
  const a = await client("A"), b = await client("B");
  const received = once(b, "note:created");
  const first = await a.emitWithAck("note:create", notePayload(20, 0));
  assert.equal(first.ok, true);
  assert.deepEqual((await received)[0].note.fencePosition, { column: 20, row: 0 });
  const race = await Promise.all([a.emitWithAck("note:create", notePayload(40, 12)), b.emitWithAck("note:create", notePayload(41, 12))]);
  assert.equal(race.filter((result) => result.ok).length, 1);
  assert.equal(race.find((result) => !result.ok).error.code, "ANCHOR_OCCUPIED");
  assert.equal((await b.emitWithAck("note:create", notePayload(70, 25))).ok, true);
  const flowers = [];
  for (const [index, roseColor] of ROSE_COLORS.entries()) {
    const event = once(a, "flower:created");
    const accepted = await b.emitWithAck("flower:create", { requestId: randomUUID(), poolSide: "north", anchorId: `north-pool-north-0${index + 1}`, roseColor });
    assert.equal(accepted.ok, true);
    assert.equal((await event)[0].flower.roseColor, roseColor);
    flowers.push(accepted.record);
  }
  const late = await client("C");
  const snapshot = await late.emitWithAck("room:join", { roomId: "new-placement", username: "C", avatarType: "female" });
  assert.equal(snapshot.state.notes.length, 3);
  assert.deepEqual(snapshot.state.flowers, flowers);
  b.disconnect(); b.connect(); await once(b, "connect");
  const restored = await b.emitWithAck("room:join", { roomId: "new-placement", username: "B", avatarType: "female" });
  assert.deepEqual(restored.state.notes, snapshot.state.notes);
  assert.deepEqual(restored.state.flowers, flowers);
});

test("tree entry composes immediately; browsing, reading and cancellation preserve a draft", async () => {
  let controls;
  function Probe() { controls = useTreeNotes({ active: true, autoCompose: true, notes: [{ id: "note" }], createNote: async () => ({ ok: true }), status: "connected" }); return null; }
  const renderer = await create(React.createElement(Probe));
  assert.equal(controls.stage, "compose");
  await act(async () => { controls.setDraft("A draft to keep"); controls.cancel(); });
  assert.equal(controls.stage, "idle");
  await act(async () => controls.viewMessages());
  assert.equal(controls.stage, "browse");
  await act(async () => controls.read("note"));
  assert.equal(controls.stage, "read");
  await act(async () => controls.cancel());
  assert.equal(controls.stage, "browse");
  await act(async () => controls.begin());
  assert.equal(controls.draft, "A draft to keep");
  await renderer.unmount();
});

test("all rose colors validate; legacy requests default white and extra flower fields stay forbidden", () => {
  const payload = { requestId: "color-test", poolSide: "north", anchorId: "north-pool-north-01" };
  assert.equal(validateContribution("flower", payload).roseColor, "white");
  for (const roseColor of ROSE_COLORS) assert.equal(validateContribution("flower", { ...payload, roseColor }).roseColor, roseColor);
  for (const roseColor of ["blue", "pink", null, {}, "<script>"])
    assert.throws(() => validateContribution("flower", { ...payload, roseColor }));
  for (const key of ["dedication", "recipientName", "message", "flowerType"])
    assert.throws(() => validateContribution("flower", { ...payload, [key]: "unsupported" }));
  const markup = renderToStaticMarkup(React.createElement(FlowerOverlay, { active: true, side: "north", flowers: [], status: "connected", controls: { roseColor: "white" }, targets: { current: new Map() } }));
  assert.equal((markup.match(/aria-pressed=/g) ?? []).length, 5);
  assert.doesNotMatch(markup, /textarea|<input|dedication|recipient/i);
});

test("rose color changes preview state and lost acknowledgements retry the original color safely", async () => {
  let controls; const requests = [];
  function Probe() { controls = usePoolFlowers({ active: true, side: "north", flowers: [], status: "connected", createFlower: async (payload) => { requests.push(payload); return { ok: false, error: { code: "ACK_TIMEOUT" } }; } }); return null; }
  const renderer = await create(React.createElement(Probe));
  await act(async () => controls.setRoseColor("red"));
  assert.equal(controls.roseColor, "red");
  const anchor = { id: "north-pool-north-01", poolSide: "north" };
  await act(async () => controls.place(anchor));
  await act(async () => controls.setRoseColor("lavender"));
  await act(async () => controls.place(anchor));
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[1].roseColor, "red");
  await act(async () => controls.place({ ...anchor, id: "north-pool-north-02" }));
  assert.equal(requests[2].roseColor, "lavender");
  await renderer.unmount();
});

test("deterministic rose variants share geometry and stay in contact with the real parapet", () => {
  const pool = loadPoolGeometry(), layout = measurePoolLayout(pool), resources = createRoseResources();
  const surfaces = []; pool.traverse((node) => { if (node.name === "pool-part-18") surfaces.push(node); });
  const ray = new THREE.Raycaster();
  const transforms = new Set();
  for (const anchor of layout.anchors) for (let index = 0; index < 4; index++) {
    const flower = { id: `stable-${index}`, roseColor: ROSE_COLORS[index] };
    const transform = roseRestingTransform(anchor, flower);
    assert.deepEqual(transform, roseRestingTransform(anchor, JSON.parse(JSON.stringify(flower))));
    transforms.add(transform.quaternion.join(","));
    const rotation = new THREE.Quaternion().fromArray(transform.quaternion);
    for (const geometry of Object.values(resources.geometries)) {
      const positions = geometry.attributes.position;
      for (let vertex = 0; vertex < positions.count; vertex += 11) {
        const local = new THREE.Vector3().fromBufferAttribute(positions, vertex);
        const base = new THREE.Vector3(local.x, 0, local.z).applyQuaternion(rotation).add(new THREE.Vector3(...transform.position));
        ray.set(base.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObjects(surfaces, false)[0];
        assert.ok(hit, `${anchor.id} remains on stone`);
        assert.ok(hit.point.distanceTo(base) < 0.003, `${anchor.id} stays against its surface`);
        const b = layout.bounds;
        const inset = anchor.poolSide === "north" ? base.z - b.min.z : anchor.poolSide === "south" ? b.max.z - base.z : anchor.poolSide === "east" ? b.max.x - base.x : base.x - b.min.x;
        assert.ok(inset > 0.005 && inset < 0.145, `${anchor.id} stays off water/names`);
      }
    }
  }
  assert.ok(transforms.size > 100);
  for (const variant of Object.values(resources.variants)) {
    assert.equal(variant.materials.stem, resources.materials.stem);
    assert.equal(variant.materials.leaves, resources.materials.leaves);
  }
  resources.dispose();
});

test("actual Survivor Tree bark center is independent of asymmetric canopy bounds", () => {
  const model = loadGeometry("../../../public/models/survivor-sakura.glb");
  const box = new THREE.Box3().setFromObject(model), trunk = treeTrunkCenter(model);
  const factor = 4 / (box.max.y - box.min.y);
  const canopy = box.getCenter(new THREE.Vector3());
  assert.ok(Math.hypot(trunk.x - canopy.x, trunk.z - canopy.z) > 0.01);
  model.position.set(-trunk.x * factor, -box.min.y * factor, -trunk.z * factor);
  model.scale.setScalar(factor); model.updateMatrixWorld(true);
  const centered = treeTrunkCenter(model);
  assert.ok(Math.hypot(centered.x, centered.z) < 1e-6);
  assert.equal(treeCameraPosition(0).y, 1.05);
});

test("lower orbit frames top, middle and bottom tags on every side without approaching the fence", () => {
  const camera = new THREE.PerspectiveCamera(46, 1.5, 0.1, 280);
  for (let column = 0; column < 96; column += 4) {
    const bearing = column / 96 * Math.PI * 2;
    camera.position.copy(treeCameraPosition(bearing + 0.5));
    camera.lookAt(SURVIVOR_TREE[0], 0.56, SURVIVOR_TREE[2]);
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const row of [0, 12, 25]) {
      const anchor = noteAnchor({ fencePosition: { column, row } });
      for (const y of [anchor.height, anchor.height - 0.46 * TAG_SCALE])
        assert.ok(frustum.containsPoint(new THREE.Vector3(anchor.position[0], y, anchor.position[2])), `column ${column}, row ${row}`);
    }
    assert.ok(Math.hypot(camera.position.x - SURVIVOR_TREE[0], camera.position.z - SURVIVOR_TREE[2]) > TREE_INSTALLATION.radius + 1);
  }
});

test("surface preview follows the cylinder across its seam and a drag cannot submit it", async () => {
  const { default: TreeNotes3D } = await import("../../src/collaboration/tree/TreeNotes3D.jsx");
  const submitted = [];
  const gesture = { current: { ready: true, dragged: false, pointers: 0, fragmentDragging: false } };
  const controls = { stage: "place", status: "connected", draft: "A small tag", place: (id) => submitted.push(id) };
  const Tag = () => React.createElement("group");
  const renderer = await create(React.createElement(TreeNotes3D, { notes: [], controls, gesture, enabled: true, Tag }), {
    beforeReturn: (canvas) => { canvas.dataset = {}; canvas.style.setProperty = () => {}; },
  });
  const surface = renderer.scene.findByProps({ name: "fence-placement-surface" });
  const event = (column, height) => ({ button: 0, delta: 0, point: new THREE.Vector3(
    SURVIVOR_TREE[0] + Math.sin(column / 96 * Math.PI * 2) * TREE_INSTALLATION.radius,
    height, SURVIVOR_TREE[2] + Math.cos(column / 96 * Math.PI * 2) * TREE_INSTALLATION.radius), clientX: 500, clientY: 500 });
  await renderer.fireEvent(surface, "pointerMove", event(95, 0.32));
  await renderer.advanceFrames(1, 1 / 60);
  const preview = renderer.scene.findByProps({ name: "fence-note-preview" }).instance;
  await renderer.fireEvent(surface, "pointerMove", event(1, 0.82));
  for (let frame = 0; frame < 20; frame++) {
    await renderer.advanceFrames(1, 1 / 60);
    assert.ok(Math.abs(Math.hypot(preview.position.x - SURVIVOR_TREE[0], preview.position.z - SURVIVOR_TREE[2]) - TREE_INSTALLATION.radius) < 1e-8);
    assert.ok(preview.position.y >= 0.32 && preview.position.y <= 0.82);
    assert.ok(preview.position.z > SURVIVOR_TREE[2], "seam motion stays on the near face");
  }
  gesture.current.dragged = true;
  await renderer.fireEvent(surface, "click", event(1, 0.82));
  assert.equal(submitted.length, 0);
  gesture.current.dragged = false;
  await renderer.fireEvent(surface, "click", event(1, 0.82));
  assert.deepEqual(submitted, ["fence-1-25"]);
  await renderer.unmount();
});
