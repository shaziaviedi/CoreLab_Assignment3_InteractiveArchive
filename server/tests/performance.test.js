import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import React from "react";
import { useThree } from "@react-three/fiber";
import DreamySurfaceLight from "../../src/DreamySurfaceLight.jsx";
import { create } from "@react-three/test-renderer";
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3 } from "three";
import { observeObjectTree } from "../../src/scene/objectLifecycle.js";
import { createCameraObstacles } from "../../src/scene/cameraObstacles.js";
import { visitorInView } from "../../src/scene/visitorVisibility.js";
import { collaborationConfig } from "../../src/collaboration/config.js";
import useMemorialSocket from "../../src/collaboration/useMemorialSocket.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("topology observer tracks late subtrees and stops observing removed objects", () => {
  const root = new Group(), branch = new Group(), leaf = new Group();
  branch.add(leaf);
  const live = new Set();
  const dispose = observeObjectTree(root, (object) => live.add(object), (object) => live.delete(object));
  root.add(branch);
  assert.deepEqual(live, new Set([root, branch, leaf]));
  root.remove(branch);
  branch.add(new Group());
  assert.deepEqual(live, new Set([root]));
  dispose();
  root.add(new Group());
  assert.equal(live.size, 0);
});

test("camera bounds are reused until geometry mounts or unmounts", () => {
  const scene = new Group(), obstacle = new Group();
  obstacle.userData.cameraObstacle = true;
  const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
  obstacle.add(mesh);
  scene.add(obstacle);
  const registry = createCameraObstacles(scene);
  const first = registry.getBoxes();
  assert.equal(first.length, 1);
  for (let frame = 0; frame < 1000; frame++) assert.equal(registry.getBoxes(), first);
  const extension = mesh.clone();
  extension.position.x = 8;
  obstacle.add(extension);
  assert.ok(registry.getBoxes()[0].max.x > 9);
  scene.remove(obstacle);
  assert.equal(registry.getBoxes().length, 0);
  registry.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("visitor visibility follows camera transfers and conservatively includes view edges", () => {
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 280);
  camera.updateMatrixWorld();
  assert.equal(visitorInView(camera, 1, new Vector3(0, 0, -10)), true);
  assert.equal(visitorInView(camera, 1, new Vector3(100, 0, -10)), false);
  camera.lookAt(100, 0, -10);
  camera.updateMatrixWorld();
  assert.equal(visitorInView(camera, 2, new Vector3(100, 0, -10)), true);
});

test("offline mode creates no socket, including rerenders and manual reconnect", async () => {
  assert.equal(collaborationConfig({ VITE_ENABLE_COLLAB: "false" }).enabled, false);
  assert.equal(collaborationConfig({ DEV: true }).url, "http://localhost:3001");
  let calls = 0, state;
  const factory = () => { calls++; throw new Error("Offline mode must not create a socket"); };
  function Probe({ username }) {
    state = useMemorialSocket({ visitorId: "offline-test", username, avatarType: "male" }, "memorial", false, factory);
    return null;
  }
  const renderer = await create(React.createElement(Probe, { username: "A" }));
  assert.equal(state.status, "offline");
  await renderer.update(React.createElement(Probe, { username: "B" }));
  state.reconnect();
  state.updateZone("tree");
  assert.equal(calls, 0);
  assert.deepEqual(state.visitors, []);
  await renderer.unmount();
});


test("surface light preserves existing shader hooks and releases removed materials", async () => {
  const material = new MeshStandardMaterial();
  const geometry = new BoxGeometry();
  const first = new Mesh(geometry, material), second = new Mesh(geometry, material);
  const before = (shader) => { shader.uniforms.existingEffect = { value: 1 }; };
  material.onBeforeCompile = before;
  const key = material.customProgramCacheKey;
  let scene;
  function Probe() { scene = useThree((state) => state.scene); return null; }
  const renderer = await create(React.createElement(React.Fragment, null,
    React.createElement(DreamySurfaceLight, {
      celestial: { current: { sun: 1, moon: 0, to: "sun" } }, lightPosition: new Vector3(1, 50, 0),
    }), React.createElement(Probe)));
  scene.add(first, second);
  for (const mesh of [first, second]) mesh.onBeforeRender(null, scene, null, geometry, material);
  const shader = { uniforms: {}, fragmentShader: "#include <lights_fragment_end>" };
  material.onBeforeCompile(shader, null);
  assert.equal(shader.uniforms.existingEffect.value, 1);
  assert.ok(shader.uniforms.dreamStrength);
  assert.match(shader.fragmentShader, /dreamGlint/);
  scene.remove(first);
  assert.notEqual(material.onBeforeCompile, before);
  scene.remove(second);
  assert.equal(material.onBeforeCompile, before);
  assert.equal(material.customProgramCacheKey, key);
  await renderer.unmount();
  geometry.dispose();
  material.dispose();
});


test("turning collaboration off disconnects and removes socket and manager listeners", async () => {
  const socket = new EventEmitter();
  socket.io = new EventEmitter();
  let disconnected = 0;
  socket.connect = () => socket;
  socket.disconnect = () => { disconnected++; return socket; };
  const factory = () => socket;
  const identity = { visitorId: "toggle-test", username: "Visitor", avatarType: "female" };
  let state;
  function Probe({ enabled }) {
    state = useMemorialSocket(identity, "memorial", enabled, factory);
    return null;
  }
  const renderer = await create(React.createElement(Probe, { enabled: true }));
  assert.ok(socket.eventNames().length > 0);
  assert.equal(socket.io.listenerCount("reconnect_attempt"), 1);
  await renderer.update(React.createElement(Probe, { enabled: false }));
  assert.equal(disconnected, 1);
  assert.deepEqual(socket.eventNames(), []);
  assert.deepEqual(socket.io.eventNames(), []);
  assert.equal(state.status, "offline");
  await renderer.unmount();
  assert.equal(disconnected, 1);
});
