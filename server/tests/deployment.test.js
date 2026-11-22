import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { deploymentConfig, validateBasePath } from "../../scripts/deployment/config.mjs";
import { EVENTS } from "../../shared/protocol.js";
import { LAYOUT_VERSION } from "../../shared/memorialLayout.js";
import useMemorialSocket from "../../src/collaboration/useMemorialSocket.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("deployment settings reject missing, insecure or placeholder backends and malformed Pages paths", () => {
  const env = { VITE_ENABLE_COLLAB: "true", VITE_SOCKET_URL: "https://memorial-test.onrender.com", VITE_BASE_PATH: "/CoreLab_Assignment3_InteractiveArchive/" };
  assert.deepEqual(deploymentConfig(env), { backendUrl: env.VITE_SOCKET_URL, base: env.VITE_BASE_PATH });
  for (const url of [undefined, "http://memorial-test.onrender.com", "https://localhost", "https://example.invalid", "https://example.com", "https://memorial-test.onrender.com/path", "https://memorial-test.onrender.com/", "https://user:password@memorial-test.onrender.com"])
    assert.throws(() => deploymentConfig({ ...env, VITE_SOCKET_URL: url }));
  assert.throws(() => deploymentConfig({ ...env, VITE_ENABLE_COLLAB: "false" }));
  for (const base of ["repository", "/repository", "//", "/../", "/repository/?room=a"])
    assert.throws(() => validateBasePath(base));
  assert.equal(validateBasePath("/"), "/");
});

class TestSocket extends EventEmitter {
  id = "review-socket";
  io = new EventEmitter();
  connected = false;
  active = false;
  timeout() { return this; }
  connect() { this.connected = true; this.emit("connect"); return this; }
  disconnect() { this.connected = false; this.emit("disconnect"); return this; }
}
const identity = { visitorId: "review-visitor", username: "Review", avatarType: "male" };
const snapshot = { roomId: "review-room", layoutVersion: LAYOUT_VERSION, revision: 0, visitors: [], notes: [], flowers: [] };

test("repeated mounting and shared-state rerenders retain one listener per event and remove every listener", async () => {
  for (let mount = 0; mount < 3; mount++) {
    const socket = new TestSocket();
    let connections = 0, state;
    const factory = () => { connections++; return socket; };
    function Probe() { state = useMemorialSocket(identity, "review-room", true, factory); return null; }
    const renderer = await create(React.createElement(Probe));
    await act(async () => socket.emit(EVENTS.STATE, snapshot));
    for (let index = 0; index < 5; index++) {
      await act(async () => socket.emit(EVENTS.NOTE_CREATED, { roomId: "review-room", revision: index + 1,
        note: { id: `note-${index}`, authorId: identity.visitorId, text: "Literal <b>text</b>" } }));
      assert.equal(socket.listenerCount(EVENTS.NOTE_CREATED), 1);
      assert.equal(socket.listenerCount(EVENTS.FLOWER_CREATED), 1);
      assert.equal(socket.io.listenerCount("reconnect_attempt"), 1);
    }
    assert.equal(state.notes.length, 5);
    assert.equal(connections, 1);
    await renderer.unmount();
    assert.deepEqual(socket.eventNames(), []);
    assert.deepEqual(socket.io.eventNames(), []);
    assert.equal(socket.connected, false);
  }
});

test("a mismatched deployed layout prevents placement and asks the visitor to reload", async () => {
  const socket = new TestSocket();
  const factory = () => socket;
  let state;
  function Probe() { state = useMemorialSocket(identity, "review-room", true, factory); return null; }
  const renderer = await create(React.createElement(Probe));
  try {
    await act(async () => socket.emit(EVENTS.STATE, { ...snapshot, layoutVersion: LAYOUT_VERSION + 1 }));
    assert.equal(state.status, "disconnected");
    assert.match(state.error, /Reload/);
    const result = await state.createFlower({ poolSide: "north", anchorId: "north-pool-north-01", requestId: "blocked" });
    assert.equal(result.error.code, "DISCONNECTED");
    assert.deepEqual(state.flowers, []);
  } finally { await renderer.unmount(); }
});
