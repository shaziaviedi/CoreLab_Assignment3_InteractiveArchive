import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import test from "node:test";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { io } from "socket.io-client";
import { createMemorialServer } from "../app.js";
import { readConfig } from "../config.js";
import useMemorialSocket from "../../src/collaboration/useMemorialSocket.js";
import useTreeNotes from "../../src/collaboration/tree/useTreeNotes.js";
import { TREE_NOTE_ANCHORS, limitNote, noteLength } from "../../src/collaboration/tree/treeNoteLayout.js";
import { NOTE_ANCHORS } from "../../shared/memorialLayout.js";
import { SURVIVOR_TREE } from "../../src/scene/memorialLayout.js";
import TreeNotes3D from "../../src/collaboration/tree/TreeNotes3D.jsx";
import { submitTreeNote } from "../../src/collaboration/tree/noteSubmission.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function eventually(predicate) {
  for (let attempt = 0; attempt < 150; attempt++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    if (predicate()) return;
  }
  assert.fail("Timed out waiting for synchronized room state");
}

test("real hook clients synchronize notes, conflicts, late joins and reconnect snapshots", async (t) => {
  const server = createMemorialServer(readConfig({}));
  server.httpServer.listen(0, "127.0.0.1");
  await once(server.httpServer, "listening");
  const sockets = [], states = {};
  const factory = () => {
    const socket = io(`http://127.0.0.1:${server.httpServer.address().port}`, {
      autoConnect: false, reconnection: false, forceNew: true,
    });
    sockets.push(socket);
    return socket;
  };
  const profiles = ["Ada", "Bea", "Cai"].map((username, index) => ({
    visitorId: randomUUID(), username, avatarType: index === 1 ? "female" : "male",
  }));
  function Probe({ index }) {
    states[index] = useMemorialSocket(profiles[index], "tree-test", true, factory);
    return null;
  }
  const children = (count) => React.createElement(React.Fragment, null,
    ...profiles.slice(0, count).map((_, index) => React.createElement(Probe, { key: index, index })));
  const renderer = await create(children(2));
  t.after(async () => {
    await renderer.unmount();
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => server.io.close(resolve));
  });
  await eventually(() => states[0]?.status === "connected" && states[1]?.visitors.length === 2);
  const payload = (anchorId, text) => ({ requestId: randomUUID(), anchorId, text });
  let results;
  await act(async () => {
    results = await Promise.all([
      states[0].createNote(payload("tree-01", "Remembered together.")),
      states[1].createNote(payload("tree-02", "A quiet moment.")),
    ]);
  });
  assert.ok(results.every((result) => result.ok));
  await eventually(() => states[0].notes.length === 2 && states[1].notes.length === 2);
  assert.deepEqual(new Set(states[0].notes.map((note) => note.authorName)), new Set(["Ada", "Bea"]));
  assert.equal(states[0].notes.find((note) => note.authorName === "Bea").authorAvatar, "female");
  await act(async () => {
    results = await Promise.all([
      states[0].createNote(payload("tree-03", "First visitor")),
      states[1].createNote(payload("tree-03", "Second visitor")),
    ]);
  });
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.find((result) => !result.ok).error.code, "ANCHOR_OCCUPIED");
  await renderer.update(children(3));
  await eventually(() => states[2]?.status === "connected" && states[2]?.notes.length === 3);
  assert.equal(new Set(states[2].notes.map((note) => note.anchorId)).size, 3);
  await act(async () => { sockets[0].disconnect(); });
  const retry = payload("tree-04", "<script>Plain words, never HTML.</script>");
  await act(async () => {
    const first = await states[1].createNote(retry);
    const second = await states[1].createNote(retry);
    assert.equal(first.record.id, second.record.id);
    assert.equal(second.duplicate, true);
  });
  assert.equal(states[0].notes.length, 3);
  await act(async () => { sockets[0].connect(); });
  await eventually(() => states[0].status === "connected" && states[0].notes.length === 4);
  assert.equal(states[0].notes.find((note) => note.anchorId === "tree-04").text, retry.text);
});

test("tree anchors stay fixed on the installation and Unicode limits match the server", () => {
  assert.deepEqual(TREE_NOTE_ANCHORS.map((anchor) => anchor.id), [...NOTE_ANCHORS]);
  assert.equal(new Set(TREE_NOTE_ANCHORS.map((anchor) => anchor.position.join(","))).size, 24);
  for (const anchor of TREE_NOTE_ANCHORS) {
    assert.ok(Math.abs(Math.hypot(anchor.position[0] - SURVIVOR_TREE[0], anchor.position[2] - SURVIVOR_TREE[2]) - 1.35) < 1e-10);
    assert.ok(anchor.position[1] > 0.5);
  }
  assert.equal(noteLength(limitNote("🌿".repeat(181))), 180);
});

test("draft survives conflicts and lost acknowledgements retry the original request once", async () => {
  let state, resolve;
  const requests = [];
  const send = (payload) => { requests.push(payload); return new Promise((done) => { resolve = done; }); };
  function Probe() { state = useTreeNotes({ active: true, notes: [], createNote: send, status: "connected" }); return null; }
  const renderer = await create(React.createElement(Probe));
  await act(async () => { state.begin(); state.setDraft("A message kept safely."); });
  await act(async () => { state.continueToPlacement(); });
  let completion;
  await act(async () => { completion = state.place("tree-01"); state.place("tree-01"); });
  assert.equal(requests.length, 1);
  await act(async () => { resolve({ ok: false, error: { code: "ANCHOR_OCCUPIED", message: "Choose another position." } }); await completion; });
  assert.equal(state.draft, "A message kept safely.");
  assert.equal(state.stage, "place");
  await act(async () => { completion = state.place("tree-02"); });
  assert.notEqual(requests[0].requestId, requests[1].requestId);
  await act(async () => { resolve({ ok: false, error: { code: "ACK_TIMEOUT", message: "Retry this position." } }); await completion; });
  assert.equal(state.uncertain, true);
  await act(async () => { state.retry(); });
  assert.equal(requests[1].requestId, requests[2].requestId);
  await act(async () => { resolve({ ok: true }); await Promise.resolve(); });
  assert.equal(state.stage, "idle");
  assert.equal(state.draft, "");
  await renderer.unmount();
});

test("raycast targets omit occupied anchors, consume clicks and reject orbit drags", async () => {
  const gesture = { current: { ready: true, dragged: false, pointers: 0, fragmentDragging: false } };
  const placed = [], read = [];
  const controls = { stage: "place", draft: "A note", status: "connected", place: (id) => placed.push(id), read: (id) => read.push(id) };
  const note = { id: "existing", anchorId: "tree-01", text: "Already here" };
  // Rendering geometry/interaction is independent of browser CanvasTexture creation.
  const Tag = (props) => React.createElement("mesh", props);
  const renderer = await create(React.createElement(TreeNotes3D, { notes: [note], controls, enabled: true, gesture, Tag }), { camera: { position: [-3, 1.7, 13.12] }, beforeReturn: (canvas) => { canvas.dataset = {}; } });
  const targets = renderer.scene.findAll((node) => typeof node.props.onClick === "function");
  assert.equal(targets.length, 24); // 23 free anchors plus the readable existing tag.
  const target = targets[1];
  await renderer.fireEvent(target, "click", { button: 0, delta: 0 });
  assert.equal(placed.length, 1);
  assert.notEqual(placed[0], "tree-01");
  gesture.current.dragged = true;
  await renderer.fireEvent(target, "click", { button: 0, delta: 20 });
  assert.equal(placed.length, 1);
  gesture.current.dragged = false;
  await renderer.fireEvent(targets[0], "click", { button: 0, delta: 0 });
  assert.deepEqual(read, ["existing"]);
  await renderer.unmount();
});

test("offline submission makes no request and timeouts return a recoverable error", async () => {
  assert.equal((await submitTreeNote(null, false, {})).error.code, "DISCONNECTED");
  const socket = { connected: true, timeout: () => ({ emit: (_event, _payload, ack) => ack(new Error("timeout")) }) };
  assert.equal((await submitTreeNote(socket, true, {})).error.code, "ACK_TIMEOUT");
});
