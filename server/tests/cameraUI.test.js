import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { FENCE_GRID } from "../../shared/fenceLayout.js";
import { TREE_INSTALLATION } from "../../shared/memorialLayout.js";
import { SURVIVOR_TREE } from "../../src/scene/memorialLayout.js";
import { treeCameraPosition } from "../../src/scene/navigation.js";
import { canActivate, canHover } from "../../src/scene/useInteractionMode.js";
import { createFencePicker, noteReadingFrame } from "../../src/collaboration/tree/treeInteraction.js";
import { noteAnchor, NOTE_RADIUS, TAG_SCALE } from "../../src/collaboration/tree/treeNoteLayout.js";
import useTreeNotes from "../../src/collaboration/tree/useTreeNotes.js";
import TreeNotePanel from "../../src/collaboration/tree/TreeNotePanel.jsx";
import usePoolFlowers from "../../src/collaboration/flowers/usePoolFlowers.js";
import FlowerOverlay from "../../src/collaboration/flowers/FlowerOverlay.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("releasing an orbit restores hover without allowing its trailing click", () => {
  const gesture = { ready: true, dragged: true, pointers: 1, fragmentDragging: false };
  assert.equal(canHover(gesture), false);
  gesture.pointers = 0;
  assert.equal(canHover(gesture), true);
  assert.equal(canActivate(gesture, { button: 0, delta: 0 }), false);
  gesture.dragged = false; // next deliberate pointerdown
  assert.equal(canActivate(gesture, { button: 0, delta: 0 }), true);
});

test("live-camera fence raycasts work at every orbit angle, height and canvas offset", () => {
  const installation = new THREE.Group(); installation.position.fromArray(SURVIVOR_TREE);
  const surface = new THREE.Mesh(new THREE.CylinderGeometry(0.854, 0.854, 0.5, 96, 1, true), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  surface.position.y = 0.57; installation.add(surface);
  const pick = createFencePicker(), rect = { left: 41, top: 57, width: 1280, height: 800 };
  const canvas = { getBoundingClientRect: () => rect };
  const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 280);
  camera.position.set(-3, 1.05, 13); camera.updateMatrixWorld();
  for (let column = 0; column < 96; column += 4) for (const row of [0, 12, 25]) {
    const angle = column / 96 * Math.PI * 2;
    camera.position.copy(treeCameraPosition(angle + 0.5));
    camera.lookAt(SURVIVOR_TREE[0], 0.56, SURVIVOR_TREE[2]);
    // Deliberately leave camera.matrixWorld stale; the picker must refresh it.
    const expected = camera.clone(); expected.updateMatrixWorld(true);
    const height = Math.max(0.321, Math.min(0.819, FENCE_GRID.bottom + row * FENCE_GRID.step));
    const world = new THREE.Vector3(SURVIVOR_TREE[0] + Math.sin(angle) * 0.854, height, SURVIVOR_TREE[2] + Math.cos(angle) * 0.854);
    const screen = world.clone().project(expected);
    const anchor = pick({ clientX: rect.left + (screen.x + 1) * rect.width / 2, clientY: rect.top + (1 - screen.y) * rect.height / 2 }, camera, canvas, surface, installation);
    assert.ok(anchor, `column ${column}, row ${row}`);
    assert.deepEqual(anchor.fencePosition, { column, row });
    assert.ok(Math.abs(Math.hypot(anchor.position[0] - SURVIVOR_TREE[0], anchor.position[2] - SURVIVOR_TREE[2]) - NOTE_RADIUS) < 1e-9);
  }
  surface.geometry.dispose(); surface.material.dispose();
});

test("composer waits for arrival; SUBMIT only advances a retained local draft", async () => {
  let controls, arrived = false, sent = 0;
  function Probe() { controls = useTreeNotes({ active: true, autoCompose: true, arrived, notes: [], createNote: async () => { sent++; return { ok: true }; }, status: "connected" }); return null; }
  const renderer = await create(React.createElement(Probe));
  assert.equal(controls.stage, "arriving");
  assert.equal(renderToStaticMarkup(React.createElement(TreeNotePanel, { controls, active: true })), "");
  arrived = true; await renderer.update(React.createElement(Probe));
  assert.equal(controls.stage, "compose");
  const html = renderToStaticMarkup(React.createElement(TreeNotePanel, { controls, active: true }));
  assert.ok(html.indexOf("CANCEL") < html.indexOf("SUBMIT"));
  assert.doesNotMatch(html, /Continue to placement/);
  await act(async () => controls.setDraft("A preserved draft"));
  await act(async () => controls.continueToPlacement());
  assert.equal(controls.stage, "place"); assert.equal(controls.draft, "A preserved draft"); assert.equal(sent, 0);
  await renderer.unmount();
});

test("note reading uses a close 3D frame without a separate message card", () => {
  const note = { id: "read", anchorId: "tree-01", text: "Words on the paper", authorName: "A", createdAt: new Date().toISOString() };
  const frame = noteReadingFrame(note);
  assert.ok(frame.position.distanceTo(frame.target) > 0.6 && frame.position.distanceTo(frame.target) < 0.8);
  const html = renderToStaticMarkup(React.createElement(TreeNotePanel, { active: true, controls: { stage: "read", selected: note }, moderation: { hiddenNoteIds: new Set() } }));
  assert.doesNotMatch(html, /role="dialog"|paper-note-preview|tree-note-author/);
  assert.match(html, /BACK TO MESSAGES/);
  assert.match(html, /visually-hidden/);
});

test("normal-relative paper clearance stays in front of poles throughout settling and breeze", () => {
  for (let column = 0; column < 96; column += 4) for (const row of [0, 12, 25]) {
    const anchor = noteAnchor({ fencePosition: { column, row } });
    for (const tilt of [-0.195, 0.035]) for (const x of [-0.17, 0.17]) for (const y of [-0.46, -0.03]) {
      const local = new THREE.Vector3(x, y, 0.014).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt).multiplyScalar(TAG_SCALE);
      local.applyAxisAngle(new THREE.Vector3(0, 1, 0), anchor.angle).add(new THREE.Vector3(...anchor.position));
      assert.ok(Math.hypot(local.x - SURVIVOR_TREE[0], local.z - SURVIVOR_TREE[2]) > TREE_INSTALLATION.radius + 0.019 + 0.004);
    }
  }
});

test("the pool's single status area changes only after acknowledgement and then resets", async (t) => {
  let controls, resolve;
  function Probe() { controls = usePoolFlowers({ active: true, side: "north", flowers: [], status: "connected", createFlower: () => new Promise((done) => { resolve = done; }) }); return null; }
  const renderer = await create(React.createElement(Probe));
  const html = () => renderToStaticMarkup(React.createElement(FlowerOverlay, { active: true, side: "north", flowers: [], controls, status: "connected", targets: { current: new Map() } }));
  assert.match(html(), /Hover and click to leave a rose/);
  let completion; await act(async () => { completion = controls.place({ id: "north-pool-north-01", poolSide: "north" }); });
  assert.doesNotMatch(html(), /Your flower has been placed/);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    await act(async () => { resolve({ ok: true }); await completion; });
    assert.match(html(), /Your flower has been placed/);
    assert.doesNotMatch(html(), /Hover and click to leave a rose|collaboration-notice/);
    await act(async () => t.mock.timers.tick(3000));
    assert.match(html(), /Hover and click to leave a rose/);
  } finally { t.mock.timers.reset(); await renderer.unmount(); }
});

test("complete 180-character messages fit the paper without silently losing final lines", async () => {
  const { layoutPaperText } = await import("../../src/collaboration/tree/paperTexture.js");
  const context = { font: "", measureText(value) { return { width: [...value].length * parseInt(this.font) }; } };
  for (const text of ["W".repeat(180), Array.from({ length: 90 }, () => "a").join("\n"), "A quiet moment.\nRemembered together."]) {
    const layout = layoutPaperText(context, text);
    assert.ok(layout.lines.length * layout.lineHeight <= 490);
    assert.equal(layout.lines.join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
  }
  const sentence = "A quiet moment, shared across the memorial.";
  const words = layoutPaperText(context, sentence);
  assert.equal(words.lines.join(""), sentence);
  assert.ok(words.lines.slice(0, -1).every(line => line.endsWith(" ")));
});

test("reading frames fit the complete paper on narrow and desktop viewports", () => {
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1440, 900]]) {
    const note = { fencePosition: { column: 0, row: 12 } }, anchor = noteAnchor(note);
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 280);
    const frame = noteReadingFrame(note, new THREE.Vector3(), new THREE.Vector3(), width / height);
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const x of [-0.17, 0.17]) for (const y of [-0.46, -0.03]) {
      const point = new THREE.Vector3(x, y, 0.018).multiplyScalar(TAG_SCALE).add(new THREE.Vector3(...anchor.position));
      assert.ok(frustum.containsPoint(point), `${width} x ${height}`);
    }
  }
});

test("cancelling an interrupted arrival does not reopen the composer later", async () => {
  let controls, arrived = false;
  function Probe() { controls = useTreeNotes({ active: true, autoCompose: true, arrived, notes: [], status: "connected" }); return null; }
  const renderer = await create(React.createElement(Probe));
  assert.equal(controls.stage, "arriving");
  await act(async () => controls.cancel());
  arrived = true; await renderer.update(React.createElement(Probe));
  assert.equal(controls.stage, "idle");
  await renderer.unmount();
});

test("photography activity synchronizes between independent visitors without changing identity", async (t) => {
  const [{ createMemorialServer }, { readConfig }, { io }, { once }, { ACTIVITY_LABELS, visitorActivity }] = await Promise.all([
    import("../app.js"), import("../config.js"), import("socket.io-client"), import("node:events"),
    import("../../src/collaboration/presence/presentation.js"),
  ]);
  const server = createMemorialServer(readConfig({})), sockets = [];
  t.after(async () => { sockets.forEach((socket) => socket.disconnect()); await new Promise((resolve) => server.io.close(resolve)); });
  server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  for (const [username, avatarType] of [["Camera A", "male"], ["Camera B", "female"]]) {
    const socket = io(`http://127.0.0.1:${server.httpServer.address().port}`, { forceNew: true, reconnection: false });
    sockets.push(socket); await once(socket, "connect");
    assert.equal((await socket.emitWithAck("room:join", { roomId: "photography-presence", username, avatarType })).ok, true);
  }
  const received = once(sockets[1], "presence:update");
  assert.equal((await sockets[0].emitWithAck("presence:update", { currentZone: "tree", activity: "photographing" })).ok, true);
  const { visitor } = (await received)[0];
  assert.equal(visitor.username, "Camera A"); assert.equal(visitor.avatarType, "male");
  assert.equal(ACTIVITY_LABELS[visitorActivity(visitor)], "Taking a Photograph");
});
