import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { create, act } from "@react-three/test-renderer";
import { io } from "socket.io-client";
import * as THREE from "three";
import { createMemorialServer } from "../app.js";
import { readConfig } from "../config.js";
import { loadPoolGeometry } from "./helpers/poolGeometry.js";
import { measurePoolLayout, poolCameraPosition, poolCameraTarget } from "../../src/scene/navigation.js";
import { POOL_SIDES } from "../../shared/protocol.js";
import useMemorialSocket from "../../src/collaboration/useMemorialSocket.js";
import usePoolFlowers from "../../src/collaboration/flowers/usePoolFlowers.js";
import PoolFlowers3D from "../../src/collaboration/flowers/PoolFlowers3D.jsx";
import { createRoseResources } from "../../src/collaboration/flowers/roseGeometry.js";
import { projectFlower, formatFlowerTime } from "../../src/collaboration/flowers/flowerProjection.js";
import { submitFlower } from "../../src/collaboration/flowers/flowerSubmission.js";
import { useThree } from "@react-three/fiber";
import FlowerOverlay, { FlowerFocusTarget } from "../../src/collaboration/flowers/FlowerOverlay.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const pool = loadPoolGeometry();
const layout = measurePoolLayout(pool);
const payload = (side, index = 1) => ({
  requestId: randomUUID(), poolSide: side, anchorId: `north-pool-${side}-${String(index).padStart(2, "0")}`,
});
async function eventually(predicate) {
  for (let attempt = 0; attempt < 150; attempt++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    if (predicate()) return;
  }
  assert.fail("Timed out waiting for shared flowers");
}

test("flower hooks synchronize sides 1/3, resolve races and reconcile late joins/reconnects", async (t) => {
  const server = createMemorialServer(readConfig({}));
  server.httpServer.listen(0, "127.0.0.1");
  await once(server.httpServer, "listening");
  const states = {}, sockets = [];
  const factory = () => {
    const socket = io(`http://127.0.0.1:${server.httpServer.address().port}`, { autoConnect: false, forceNew: true, reconnection: false });
    sockets.push(socket);
    return socket;
  };
  const profiles = ["Alex", "Bea", "Cai"].map((username, index) => ({ username, visitorId: randomUUID(), avatarType: index === 1 ? "female" : "male" }));
  function Probe({ index }) { states[index] = useMemorialSocket(profiles[index], "flowers-review", true, factory); return null; }
  const children = (count) => React.createElement(React.Fragment, null,
    ...profiles.slice(0, count).map((_, index) => React.createElement(Probe, { key: index, index })));
  const renderer = await create(children(2));
  t.after(async () => {
    await renderer.unmount();
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => server.io.close(resolve));
  });
  await eventually(() => states[0]?.status === "connected" && states[1]?.visitors.length === 2);
  const firstRequest = payload("north");
  let first;
  await act(async () => { first = await states[0].createFlower(firstRequest); });
  assert.equal(first.ok, true);
  await eventually(() => states[1].flowers.length === 1);
  const received = states[1].flowers[0];
  assert.equal(received.authorName, "Alex");
  assert.equal(received.authorAvatar, "male");
  assert.equal(received.createdAt, new Date(received.createdAt).toISOString());
  assert.equal(received.roomId, "flowers-review");
  assert.deepEqual(Object.keys(received).sort(), ["id", "roomId", "authorId", "authorName", "authorAvatar", "poolSide", "anchorId", "createdAt"].sort());
  await act(async () => { assert.equal((await states[1].createFlower(payload("south"))).ok, true); });
  await eventually(() => states[0].flowers.length === 2);
  let race;
  await act(async () => { race = await Promise.all([states[0].createFlower(payload("east")), states[1].createFlower(payload("east"))]); });
  assert.equal(race.filter((result) => result.ok).length, 1);
  assert.equal(race.find((result) => !result.ok).error.code, "ANCHOR_OCCUPIED");
  await renderer.update(children(3));
  await eventually(() => states[2]?.status === "connected" && states[2]?.flowers.length === 3);
  await act(async () => {
    const duplicate = await states[0].createFlower(firstRequest);
    assert.equal(duplicate.record.id, first.record.id);
    assert.equal(duplicate.duplicate, true);
    sockets[0].disconnect();
  });
  await act(async () => { await states[1].createFlower(payload("west")); });
  assert.equal(states[0].flowers.length, 3);
  await act(async () => { sockets[0].connect(); });
  await eventually(() => states[0].status === "connected" && states[0].flowers.length === 4);
  assert.equal(new Set(states[0].flowers.map((flower) => flower.anchorId)).size, 4);
  const wrongRoom = await sockets[1].timeout(2000).emitWithAck("flower:create", { ...payload("north", 2), roomId: "other-room" });
  assert.equal(wrongRoom.error.code, "ROOM_MISMATCH");
});

test("rose footprints follow the real parapet surface, away from corners, water and inner panels", () => {
  const surfaces = [];
  pool.traverse((object) => { if (object.name === "pool-part-18") surfaces.push(object); });
  const ray = new THREE.Raycaster();
  for (const anchor of layout.anchors) {
    const rotation = new THREE.Quaternion().fromArray(anchor.quaternion);
    assert.ok(Math.abs(rotation.length() - 1) < 1e-8);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
    assert.ok(normal.y > 0.8);
    for (const x of [-0.2, 0.184]) for (const z of [-0.062, 0.055]) {
      const point = new THREE.Vector3(x, 0, z).applyQuaternion(rotation).add(new THREE.Vector3(...anchor.position));
      ray.set(point.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(surfaces, false)[0];
      assert.ok(hit, `${anchor.id} footprint must remain on the parapet`);
      assert.ok(hit.point.distanceTo(point) < 0.003, `${anchor.id} must lie against its surface`);
      const b = layout.bounds;
      const inset = anchor.poolSide === "north" ? point.z - b.min.z : anchor.poolSide === "south" ? b.max.z - point.z :
        anchor.poolSide === "east" ? b.max.x - point.x : point.x - b.min.x;
      assert.ok(inset > 0.015 && inset < 0.14, `${anchor.id} must stay inside the reserved outer margin`);
    }
  }
  const resources = createRoseResources();
  const bounds = new THREE.Box3();
  let triangles = 0;
  for (const geometry of Object.values(resources.geometries)) {
    geometry.computeBoundingBox();
    bounds.union(geometry.boundingBox);
    triangles += geometry.index.count / 3;
  }
  assert.ok(bounds.min.x >= -0.26 && bounds.max.x <= 0.24);
  assert.ok(bounds.min.z >= -0.08 && bounds.max.z <= 0.08);
  assert.ok(bounds.min.y >= 0 && bounds.max.y < 0.12);
  assert.ok(triangles < 5000);
  resources.dispose();
});

test("projected contributor labels follow each side and keep exact server timestamps", () => {
  const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 280);
  for (let side = 0; side < 4; side++) {
    camera.position.copy(poolCameraPosition(layout, side));
    camera.lookAt(poolCameraTarget(layout, side));
    camera.updateMatrixWorld();
    const anchor = layout.anchors[side * 12 + 6];
    const point = projectFlower(anchor, camera, 1280, 800);
    assert.ok(point && point.x > 0 && point.x < 1280 && point.y > 0 && point.y < 800);
  }
  const timestamp = "2026-11-18T21:32:00.000Z";
  assert.equal(formatFlowerTime(timestamp), new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(timestamp)));
});

test("direct placement blocks double-clicks, removes failed previews and safely retries an anchor", async () => {
  let state, finish;
  const requests = [];
  const send = (input) => { requests.push(input); return new Promise((resolve) => { finish = resolve; }); };
  function Probe() { state = usePoolFlowers({ active: true, side: "north", flowers: [], createFlower: send, status: "connected" }); return null; }
  const renderer = await create(React.createElement(Probe));
  const anchor = layout.anchors[0];
  await act(async () => { state.preview(anchor.id); });
  assert.equal(state.previewId, anchor.id);
  let completion;
  await act(async () => { completion = state.place(anchor); state.place(anchor); });
  assert.equal(requests.length, 1);
  assert.equal(state.previewId, null);
  await act(async () => { finish({ ok: false, error: { code: "ACK_TIMEOUT", message: "Please retry." } }); await completion; });
  assert.equal(state.pending, false);
  assert.equal(state.error, "Please retry.");
  await act(async () => { completion = state.place(anchor); });
  assert.equal(requests[0].requestId, requests[1].requestId);
  await act(async () => { finish({ ok: false, error: { code: "ANCHOR_OCCUPIED", message: "Choose another." } }); await completion; });
  await act(async () => { completion = state.place(layout.anchors[1]); });
  assert.notEqual(requests[1].requestId, requests[2].requestId);
  await act(async () => { finish({ ok: true }); await completion; });
  assert.equal(state.pending, false);
  assert.equal(state.error, "");
  assert.deepEqual(Object.keys(requests[2]).sort(), ["requestId", "poolSide", "anchorId"].sort());
  await renderer.unmount();
});


test("3D flower targets preview free positions, suppress drags and expose touch attribution", async () => {
  const placed = [], information = [], previews = [];
  const anchor = layout.anchors[5], other = layout.anchors[24 + 5];
  const flowers = [anchor, other].map((point, index) => ({
    id: `flower-${index}`, roomId: "test", anchorId: point.id, poolSide: point.poolSide,
    authorName: "Alex", authorAvatar: "male", authorId: "visitor", createdAt: "2026-11-18T21:32:00.000Z",
  }));
  const controls = {
    pending: false, previewId: layout.anchors[6].id, info: { anchorId: anchor.id, source: "hover" },
    preview: (id) => previews.push(id), clearPreview: () => {}, place: (point) => placed.push(point.id),
    showInfo: (id, source) => information.push({ id, source }), hideInfo: () => {},
  };
  const gesture = { current: { ready: true, dragged: false, pointers: 0, fragmentDragging: false } };
  const element = { hidden: true, style: {}, tabIndex: -1 };
  const targets = { current: new Map([[anchor.id, element]]) }, tooltip = { current: { hidden: true, style: {} } };
  const Rose = ({ preview }) => React.createElement("group", { name: preview ? "preview-rose" : "placed-rose" });
  function Aim() {
    const camera = useThree((state) => state.camera);
    camera.lookAt(poolCameraTarget(layout, 0));
    camera.updateMatrixWorld();
    return null;
  }
  let props = { layout, side: "north", flowers, controls, enabled: true, infoEnabled: true, gesture, targets, tooltip, Rose };
  const scene = () => React.createElement(React.Fragment, null, React.createElement(Aim), React.createElement(PoolFlowers3D, props));
  const renderer = await create(scene(), {
    camera: { position: poolCameraPosition(layout, 0).toArray(), fov: 50 },
    width: 1280, height: 800,
    beforeReturn: (canvas) => { canvas.dataset = {}; },
  });
  await renderer.advanceFrames(1, 1 / 60);
  assert.equal(element.hidden, false);
  assert.equal(element.tabIndex, 0);
  assert.match(element.style.transform, /translate/);
  assert.equal(tooltip.current.hidden, false);
  const find = (point) => renderer.scene.find((node) => node.props.name === `flower-anchor:${point.id}`);
  await renderer.fireEvent(find(layout.anchors[6]), "pointerOver");
  assert.equal(previews.at(-1), layout.anchors[6].id);
  await renderer.fireEvent(find(layout.anchors[6]), "click", { button: 0, delta: 0 });
  assert.equal(placed.at(-1), layout.anchors[6].id);
  gesture.current.dragged = true;
  await renderer.fireEvent(find(layout.anchors[6]), "click", { button: 0, delta: 20 });
  assert.equal(placed.length, 1);
  gesture.current.dragged = false;
  await renderer.fireEvent(find(anchor), "pointerDown", { pointerType: "touch" });
  await renderer.fireEvent(find(anchor), "click", { button: 0, delta: 0 });
  assert.deepEqual(information.at(-1), { id: anchor.id, source: "tap" });
  const before = find(anchor).instance.position.clone();
  props = { ...props, side: "south", period: "moon" };
  await renderer.update(scene());
  assert.ok(find(anchor).instance.position.equals(before));
  assert.ok(find(other));
  assert.equal(renderer.scene.findAll((node) => node.props.name === "placed-rose").length, 2);
  await renderer.unmount();
});

test("keyboard focus reveals the flower's contributor and controls contain no forms or selection", () => {
  const anchor = layout.anchors[5];
  const flower = { id: "flower-1", anchorId: anchor.id, authorName: "Alex <b>", createdAt: "2026-11-18T21:32:00.000Z" };
  const events = [];
  const controls = { pending: false, info: { anchorId: anchor.id, source: "focus" },
    showInfo: (id, source) => events.push([id, source]), hideInfo: () => {}, clearPreview: () => {}, dismissInfo: () => {} };
  const targets = { current: new Map() }, tooltip = { current: null };
  const button = FlowerFocusTarget({ anchor, index: 0, flower, selectedId: flower.id, controls, status: "connected", targets });
  button.props.onFocus();
  assert.deepEqual(events, [[anchor.id, "focus"]]);
  assert.match(button.props["aria-label"], /Alex/);
  assert.equal(button.props["aria-describedby"], "flower-contributor");
  const html = renderToStaticMarkup(React.createElement(FlowerOverlay, { layout, side: "north", flowers: [flower], controls, active: true, status: "connected", targets, tooltip }));
  assert.match(html, /role="tooltip"/);
  assert.match(html, /Placed by:/);
  assert.match(html, /Alex &lt;b&gt;/);
  assert.match(html, /dateTime="2026-11-18T21:32:00.000Z"/i);
  assert.doesNotMatch(html, /<(form|input|textarea|select)\b/);
});

test("touch attribution stays visible after pointer-out and offline placement sends nothing", async () => {
  let state, sent = 0;
  const send = async () => { sent++; return { ok: true }; };
  function Probe() { state = usePoolFlowers({ active: true, side: "north", flowers: [], createFlower: send, status: "offline" }); return null; }
  const renderer = await create(React.createElement(Probe));
  await act(async () => { state.showInfo("north-pool-north-01", "tap"); });
  await act(async () => { state.showInfo("north-pool-north-01", "hover"); });
  await act(async () => { state.hideInfo("north-pool-north-01", "hover"); });
  assert.equal(state.info.source, "tap");
  await act(async () => { await state.place(layout.anchors[0]); });
  assert.equal(sent, 0);
  assert.match(state.error, /Reconnect/);
  await renderer.unmount();
  assert.equal((await submitFlower(null, false, {})).error.code, "DISCONNECTED");
});
