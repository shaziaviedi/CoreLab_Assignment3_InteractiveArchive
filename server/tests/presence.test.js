import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { io } from "socket.io-client";
import * as THREE from "three";
import { createMemorialServer } from "../app.js";
import { readConfig } from "../config.js";
import { validateJoin } from "../validation.js";
import { PresenceLimiter } from "../services/presenceLimiter.js";
import { createPresencePublisher } from "../../src/collaboration/presence/presencePublisher.js";
import useMemorialSocket from "../../src/collaboration/useMemorialSocket.js";
import { visitorActivity } from "../../src/collaboration/presence/presentation.js";
import { assignPresencePositions, landmarkBounds, peerVisitors } from "../../src/collaboration/presence/presenceLayout.js";
import { PresenceAvatar } from "../../src/collaboration/presence/PresenceScene.jsx";
import PresenceLabels from "../../src/collaboration/presence/PresenceLabels.jsx";
import { memorialRoomUrl } from "../../src/collaboration/presence/roomLink.js";
import { projectPresence } from "../../src/collaboration/presence/presenceVisibility.js";
import useReducedMotion from "../../src/scene/useReducedMotion.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(predicate) {
  for (let i = 0; i < 150; i++) {
    await act(async () => { await delay(20); });
    if (predicate()) return;
  }
  assert.fail("Presence did not synchronize");
}

test("publisher coalesces rapid zone/activity edits and cancels a stale trailing update", async () => {
  const sent = [];
  const publisher = createPresencePublisher((snapshot) => sent.push(snapshot), 30);
  publisher.publish({ currentZone: "overview", activity: "idle" });
  publisher.publish({ currentZone: "tree", activity: "writing-note" });
  publisher.publish({ currentZone: "north", activity: "placing-flower" });
  assert.equal(sent.length, 1);
  await delay(45);
  assert.deepEqual(sent[1], { currentZone: "north", activity: "placing-flower" });
  publisher.publish(sent[1]);
  await delay(40);
  assert.equal(sent.length, 2);
  publisher.publish({ currentZone: "tree", activity: "reading-note" });
  publisher.publish({ currentZone: "overview", activity: "idle" });
  publisher.cancel();
  const before = sent.length;
  await delay(40);
  assert.equal(sent.length, before);
});

test("presence flood limits expire and activity leases cannot claim another zone", () => {
  let now = 1000;
  const limiter = new PresenceLimiter(() => now);
  for (let i = 0; i < 6; i++) limiter.consume();
  assert.throws(() => limiter.consume(), { code: "PRESENCE_RATE_LIMITED" });
  now += 1000;
  limiter.consume();
  assert.throws(() => validateJoin({ roomId: "memorial", username: "A", avatarType: "male", currentZone: "north", activity: "writing-note" }), { code: "INVALID_ACTIVITY" });
  const visitor = { activity: "writing-note", activityExpiresAt: new Date(now + 20000).toISOString() };
  assert.equal(visitorActivity(visitor, now), "writing-note");
  assert.equal(visitorActivity(visitor, now + 20001), "idle");
});

test("two frontend clients share throttled activity, profiles, contributions and reconnect quietly", async (t) => {
  const server = createMemorialServer(readConfig({}));
  server.httpServer.listen(0, "127.0.0.1");
  await once(server.httpServer, "listening");
  const states = {}, sockets = [];
  const factory = () => {
    const socket = io(`http://127.0.0.1:${server.httpServer.address().port}`, { autoConnect: false, reconnection: false, forceNew: true });
    sockets.push(socket);
    return socket;
  };
  const profiles = ["Ada", "Bea"].map((username, index) => ({ username, avatarType: index ? "female" : "male", visitorId: randomUUID() }));
  function Probe({ index }) { states[index] = useMemorialSocket(profiles[index], "quiet-room", true, factory); return null; }
  const scene = () => React.createElement(React.Fragment, null, ...profiles.map((_, index) => React.createElement(Probe, { key: index, index })));
  const renderer = await create(scene());
  t.after(async () => {
    await renderer.unmount(); sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => server.io.close(resolve));
  });
  await eventually(() => states[0]?.visitors.length === 2 && states[1]?.status === "connected");
  await act(async () => { states[0].updateZone("tree", "writing-note"); });
  await eventually(() => states[1].visitors.some((visitor) => visitor.username === "Ada" && visitorActivity(visitor) === "writing-note"));
  const firstSocket = sockets[0].id;
  await act(async () => {
    states[0].updateZone("tree", "placing-note");
    states[0].updateZone("north", "placing-flower");
  });
  await eventually(() => states[1].visitors.some((visitor) => visitor.username === "Ada" && visitor.currentZone === "north" && visitor.activity === "placing-flower"));
  assert.equal(sockets[0].id, firstSocket);
  profiles[1] = { ...profiles[1], username: "<b>Bea</b>", avatarType: "male" };
  await renderer.update(scene());
  await eventually(() => states[0].visitors.some((visitor) => visitor.username === "<b>Bea</b>" && visitor.avatarType === "male"));
  const request = { requestId: randomUUID(), text: "A shared quiet moment.", anchorId: "tree-01" };
  await act(async () => { assert.equal((await states[0].createNote(request)).ok, true); });
  await eventually(() => states[1].notes.length === 1);
  assert.equal(states[1].announcement.text, "A visitor left a message.");
  const notice = states[1].announcement.id;
  await act(async () => { await states[0].createNote(request); });
  assert.equal(states[1].announcement.id, notice);
  await act(async () => {
    await states[0].createFlower({ requestId: randomUUID(), poolSide: "north", anchorId: "north-pool-north-01" });
  });
  await eventually(() => states[1].flowers.length === 1);
  assert.equal(states[1].announcement.id, notice, "remote feedback must not flood the artwork");
  assert.equal(states[0].announcement.text, "Your flower has been placed.");
  await act(async () => { sockets[0].disconnect(); });
  await act(async () => { sockets[0].connect(); });
  await eventually(() => states[0].status === "connected" && states[0].visitors.length === 2);
  assert.equal(states[0].announcement, null, "snapshots must not announce old contributions");
  assert.equal(states[0].notes.length, 1);
  assert.equal(states[0].flowers.length, 1);
});

test("presence standing positions avoid pools, tags, obstacles and one another", () => {
  const visitors = Array.from({ length: 32 }, (_, index) => ({
    socketId: `socket-${index}`, visitorId: `visitor-${index}`, joinedAt: new Date(index * 1000).toISOString(),
    currentZone: ["tree", "north", "overview", "street"][index % 4],
  }));
  const peers = peerVisitors(visitors, "visitor-0");
  assert.equal(peers.length, 24);
  assert.ok(peers.every((peer) => peer.visitorId !== "visitor-0"));
  const obstacle = new THREE.Box3(new THREE.Vector3(13, 0, 3), new THREE.Vector3(14.5, 3, 4.5));
  const positions = assignPresencePositions(peers, null, [obstacle]);
  assert.equal(positions.size, peers.length);
  const values = [...positions.values()];
  for (const position of values) {
    const [x, , z] = position;
    assert.ok(Math.hypot(x + 3, z - 9.92) >= 1.95);
    for (const box of landmarkBounds()) assert.ok(x <= box.min.x || x >= box.max.x || z <= box.min.z || z >= box.max.z);
    assert.equal(obstacle.containsPoint(new THREE.Vector3(...position)), false);
    for (const other of values) if (other !== position) assert.ok(Math.hypot(x - other[0], z - other[2]) >= 0.7);
  }
});

test("avatars cannot intercept raycasts and relocate between zones without crossing landmarks", async () => {
  const visitor = { socketId: "peer", visitorId: "peer-id", username: "Peer", avatarType: "female", currentZone: "overview" };
  const assignments = { current: new Map([["peer", [3, 0, 0]]]) }, labels = { current: new Map() }, boxes = { current: [] };
  const Avatar = () => React.createElement("mesh", { name: "test-peer-body" }, React.createElement("boxGeometry"), React.createElement("meshStandardMaterial", { transparent: true }));
  let profile = visitor;
  const scene = () => React.createElement(PresenceAvatar, { visitor: profile, assignments, labels, boxes, enabled: true, Avatar });
  const renderer = await create(scene(), { camera: { position: [0, 3, 10] } });
  await renderer.advanceFrames(100, 1 / 60);
  const root = renderer.scene.find((node) => node.props.userData?.connectedVisitor).instance;
  const body = renderer.scene.find((node) => node.props.name === "test-peer-body").instance;
  const intersections = [];
  body.raycast(new THREE.Raycaster(), intersections);
  assert.equal(intersections.length, 0);
  assert.equal(body.castShadow, false);
  assert.ok(body.material.opacity > 0.95);
  assignments.current.set("peer", [-5, 0, 12]);
  profile = { ...visitor, currentZone: "tree" };
  await renderer.update(scene());
  for (let frame = 0; frame < 150; frame++) {
    await renderer.advanceFrames(1, 1 / 60);
    assert.ok(root.position.x === 3 || root.position.x === -5, "zone transfers fade instead of walking through the scene");
  }
  assert.deepEqual(root.position.toArray(), [-5, 0, 12]);
  await renderer.unmount();
});

test("room sharing preserves Pages paths and floating labels render usernames as text", () => {
  assert.equal(memorialRoomUrl("https://example.github.io/ELSEWHERE/?profile=1&name=secret#test", "quiet-room"), "https://example.github.io/ELSEWHERE/?room=quiet-room");
  assert.throws(() => memorialRoomUrl("https://example.com", "bad room"));
  const peers = [{ socketId: "p", username: "<img src=x>", currentZone: "tree", activity: "writing-note", activityExpiresAt: new Date(Date.now() + 20000).toISOString() }];
  const html = renderToStaticMarkup(React.createElement(PresenceLabels, { peers, labels: { current: new Map() } }));
  assert.match(html, /&lt;img src=x&gt;/);
  assert.match(html, /Writing a message/);
  assert.match(html, /Survivor Tree/);
  const camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 100);
  camera.position.set(0, 1, 10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
  assert.ok(projectPresence(new THREE.Vector3(0, 1, 0), camera, 1280, 800));
  const wall = new THREE.Box3(new THREE.Vector3(-1, 0, 4), new THREE.Vector3(1, 3, 6));
  assert.equal(projectPresence(new THREE.Vector3(0, 1, 0), camera, 1280, 800, [wall]), null);
});

test("reduced-motion preferences update live and remove their listener on unmount", async () => {
  const previous = globalThis.window;
  let listener, removed = false, value;
  const query = { matches: false, addEventListener: (_, callback) => { listener = callback; }, removeEventListener: () => { removed = true; } };
  globalThis.window = { matchMedia: () => query };
  try {
    function Probe() { value = useReducedMotion(); return null; }
    const renderer = await create(React.createElement(Probe));
    assert.equal(value, false);
    await act(async () => { query.matches = true; listener(); });
    assert.equal(value, true);
    await renderer.unmount();
    assert.equal(removed, true);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
