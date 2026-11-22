import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { io } from "socket.io-client";
import { randomUUID } from "node:crypto";
import { createMemorialServer } from "../app.js";
import { readConfig } from "../config.js";
import useMemorialSocket from "../../src/collaboration/useMemorialSocket.js";
import { TREE_INSTALLATION } from "../../shared/memorialLayout.js";
import { TREE_NOTE_ANCHORS } from "../../src/collaboration/tree/treeNoteLayout.js";
import { stoppedPositions, pedestrianRoute } from "../../src/PedestrianPaths.js";
import { OBS } from "../../src/data.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function eventually(predicate) {
  const deadline = Date.now() + 7000;
  while (!predicate()) { assert.ok(Date.now() < deadline, "Timed out waiting for development state"); await act(async () => { await delay(25); }); }
}

test("source watcher ignores identical file-provider events and restarts on actual source changes", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "elsewhere-watch-test-"));
  await mkdir(join(directory, "server")); await mkdir(join(directory, "shared"));
  const path = join(directory, "server", "index.js");
  const source = 'console.log("generation:" + process.pid); setInterval(() => {}, 1000);\n';
  await writeFile(path, source);
  const processChild = spawn(process.execPath, [fileURLToPath(new URL("../../scripts/watch-server.mjs", import.meta.url))], { cwd: directory, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  processChild.stdout.on("data", (chunk) => { output += chunk; });
  processChild.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    const exited = once(processChild, "exit"); processChild.kill("SIGTERM"); await exited;
    await rm(directory, { recursive: true, force: true });
  });
  const generations = () => [...output.matchAll(/generation:(\d+)/g)];
  await eventually(() => generations().length === 1);
  await writeFile(path, source);
  await delay(450);
  assert.equal(generations().length, 1, output);
  await writeFile(path, source + "// An actual edit.\n");
  await eventually(() => generations().length === 2);
  assert.notEqual(generations()[0][1], generations()[1][1]);
});

test("a visitor automatically reconnects after a backend restart and replaces stale contributions", async (t) => {
  let server = createMemorialServer(readConfig({})), state, socket;
  server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const port = server.httpServer.address().port;
  const identity = { visitorId: randomUUID(), username: "Reconnect visitor", avatarType: "female" };
  const factory = () => {
    socket = io(`http://127.0.0.1:${port}`, { autoConnect: false, forceNew: true, reconnection: true, reconnectionDelay: 20, reconnectionDelayMax: 100, randomizationFactor: 0, timeout: 300 });
    return socket;
  };
  function Probe() { state = useMemorialSocket(identity, "restart-review", true, factory); return null; }
  const renderer = await create(React.createElement(Probe));
  t.after(async () => { await renderer.unmount(); socket.disconnect(); await new Promise((resolve) => server.io.close(resolve)); });
  await eventually(() => state.status === "connected");
  const firstSocket = socket.id;
  await act(async () => { assert.equal((await state.createNote({ requestId: randomUUID(), text: "Before restart.", anchorId: "tree-01" })).ok, true); });
  assert.equal(state.notes.length, 1);
  await act(async () => { await new Promise((resolve) => server.io.close(resolve)); });
  await eventually(() => state.status !== "connected");
  server = createMemorialServer(readConfig({}));
  server.httpServer.listen(port, "127.0.0.1"); await once(server.httpServer, "listening");
  await eventually(() => state.status === "connected" && state.visitors.length === 1);
  assert.notEqual(socket.id, firstSocket);
  assert.equal(state.visitors[0].visitorId, identity.visitorId);
  assert.deepEqual(state.notes, []);
  assert.deepEqual(state.flowers, []);
});

test("the shorter installation keeps tags above ground and observation actors outside the railing", () => {
  assert.ok(TREE_INSTALLATION.radius < 1.35 && TREE_INSTALLATION.postHeight < 1.36);
  for (const anchor of TREE_NOTE_ANCHORS) {
    assert.ok(anchor.position[1] - 0.46 * TREE_INSTALLATION.tagScale > 0.1);
    assert.ok(anchor.position[1] < TREE_INSTALLATION.postHeight);
  }
  const obstacles = [{ x: -3, z: 9.92, radius: TREE_INSTALLATION.visitorClearance }];
  for (const period of ["afternoon", "evening"]) {
    const data = OBS[period].tree;
    const stops = stoppedPositions("tree", data.stops, data.crossings, obstacles);
    assert.equal(stops.length, data.stops);
    for (const [x, z] of stops) assert.ok(Math.hypot(x + 3, z - 9.92) >= TREE_INSTALLATION.visitorClearance);
    for (let actor = 0; actor < data.crossings; actor++) for (let sample = 0; sample < 100; sample++) {
      const [x, z] = pedestrianRoute("tree", actor, sample / 100, obstacles);
      assert.ok(Math.hypot(x + 3, z - 9.92) > TREE_INSTALLATION.radius + 0.3);
    }
  }
});
