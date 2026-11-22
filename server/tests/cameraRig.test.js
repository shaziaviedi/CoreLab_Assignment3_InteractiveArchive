import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { useThree } from "@react-three/fiber";
import { create } from "@react-three/test-renderer";
import * as THREE from "three";
import MemorialCameraRig from "../../src/scene/MemorialCameraRig.jsx";
import { MemorialHotspot } from "../../src/scene/MemorialHotspots.jsx";
import { OVERVIEW, CAMERA_PRESETS } from "../../src/scene/memorialLayout.js";
import { poolCameraPosition, treeCameraPosition } from "../../src/scene/navigation.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function fixture(t) {
  const listeners = new Map(), captures = new Set(), transitions = [];
  const state = { current: null };
  const gesture = { current: { ready: false, dragged: false, pointers: 0, fragmentDragging: false } };
  const layout = {
    center: new THREE.Vector3(-6.42, 0.25, -9.93),
    bounds: new THREE.Box3(new THREE.Vector3(-12, 0.17, -15.35), new THREE.Vector3(-0.84, 0.32, -4.51)),
  };
  function Probe() {
    state.current = useThree();
    return null;
  }
  let props = {
    mode: "main", cameraZone: null, poolStep: 0, poolLayout: layout,
    interactive: true, viewReset: 0, gesture,
    onTransitionChange: (moving) => transitions.push(moving),
  };
  const element = () => React.createElement(React.Fragment, null,
    React.createElement(MemorialCameraRig, props), React.createElement(Probe));
  const renderer = await create(element(), {
    camera: { position: OVERVIEW.pos, fov: 42 },
    beforeReturn: (canvas) => {
      canvas.dataset = {};
      canvas.addEventListener = (name, fn) => listeners.set(name, fn);
      canvas.removeEventListener = (name) => listeners.delete(name);
      canvas.setPointerCapture = (id) => captures.add(id);
      canvas.hasPointerCapture = (id) => captures.has(id);
      canvas.releasePointerCapture = (id) => captures.delete(id);
      canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 });
    },
  });
  t.after(() => renderer.unmount());
  const frames = async (count = 160) => renderer.advanceFrames(count, 1 / 60);
  const update = async (changes) => {
    props = { ...props, ...changes };
    await renderer.update(element());
  };
  const pointer = (name, changes = {}) => listeners.get(name)?.({
    type: name, pointerId: 1, button: 0, clientX: 200, clientY: 200, ...changes,
  });
  await frames();
  return { state, gesture, layout, listeners, transitions, frames, update, pointer };
}

test("the mounted camera rig completes main, tree, pool and all photography transfers", async (t) => {
  const f = await fixture(t);
  const views = [
    { mode: "main", cameraZone: null, position: OVERVIEW.pos },
    { mode: "tree", treeClose: false, cameraZone: null, position: CAMERA_PRESETS.tree.pos },
    { mode: "tree", treeClose: true, cameraZone: null, position: treeCameraPosition(0).toArray() },
    ...[0, 1, 2, 3].map((step) => ({ mode: "pool", poolStep: step, cameraZone: null,
      position: poolCameraPosition(f.layout, step).toArray() })),
    ...Object.entries(CAMERA_PRESETS).map(([zone, view]) => ({ mode: "photo", cameraZone: zone, position: view.pos })),
  ];
  for (const from of views) for (const to of views) {
    await f.update({ ...from, poolStep: from.poolStep ?? 0, treeClose: from.treeClose ?? false });
    await f.frames();
    await f.update({ ...to, poolStep: to.poolStep ?? 0, treeClose: to.treeClose ?? false });
    await f.frames();
    assert.ok(f.state.current.camera.position.distanceTo(new THREE.Vector3(...to.position)) < 1e-8,
      `${from.mode} to ${to.mode}:${to.cameraZone ?? to.poolStep ?? ""}`);
    assert.equal(f.gesture.current.ready, true);
  }
  const count = f.transitions.length;
  const position = f.state.current.camera.position.clone();
  await f.update({ sharedContribution: { id: "a-new-flower" } });
  await f.frames();
  assert.equal(f.transitions.length, count);
  assert.ok(position.distanceTo(f.state.current.camera.position) < 1e-8);
});

test("mounted rig handles mouse and touch orbit, suppresses drag clicks and cleans listeners", async (t) => {
  const f = await fixture(t);
  await f.update({ mode: "tree", treeClose: true });
  await f.frames();
  const before = f.state.current.camera.position.clone();
  f.pointer("pointerdown");
  f.pointer("pointermove", { clientX: 260 });
  f.pointer("pointerup", { clientX: 260 });
  await f.frames();
  assert.equal(f.gesture.current.dragged, true);
  assert.equal(f.gesture.current.pointers, 0);
  assert.ok(before.distanceTo(f.state.current.camera.position) > 0.5);
  f.pointer("pointerdown", { pointerType: "touch" });
  f.pointer("pointermove", { pointerType: "touch", clientX: 100 });
  f.pointer("pointerup", { pointerType: "touch", clientX: 100 });
  await f.frames();
  assert.ok(before.distanceTo(f.state.current.camera.position) > 0.1);
  await f.update({ interactive: false });
  assert.equal(f.listeners.has("pointerdown"), false);
  await f.update({ interactive: true, mode: "photo", cameraZone: "tree" });
  assert.equal(f.listeners.has("pointerdown"), false);
  await f.update({ cameraZone: "north" });
  assert.equal(f.listeners.has("pointerdown"), false);
});

test("mounted rig follows both pool wrap directions without crossing the basin", async (t) => {
  const f = await fixture(t);
  await f.update({ mode: "pool", poolStep: 0 });
  await f.frames();
  for (const step of [-1, 0, 1, 2, 3, 4, 3]) {
    await f.update({ poolStep: step });
    for (let frame = 0; frame < 115; frame++) {
      await f.frames(1);
      const p = f.state.current.camera.position, b = f.layout.bounds;
      assert.ok(p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z);
    }
    assert.equal(f.gesture.current.ready, true);
  }
});

test("hotspot feedback consumes clicks and suppresses orbit drags", async (t) => {
  const gesture = { current: { ready: true, dragged: false, pointers: 0 } };
  const entered = [], hints = [];
  let canvas;
  const renderer = await create(React.createElement(MemorialHotspot, {
    zone: "tree", enabled: true, gesture,
    onEnter: (zone) => entered.push(zone), onHover: (hint) => hints.push(hint),
  }, React.createElement("mesh")), {
    beforeReturn: (element) => {
      canvas = element;
      canvas.dataset = {};
      canvas.style.setProperty = () => {};
    },
  });
  t.after(() => renderer.unmount());
  const hotspot = renderer.scene.find((node) => typeof node.props.onClick === "function");
  await renderer.fireEvent(hotspot, "pointerOver", { clientX: 120, clientY: 80 });
  assert.equal(canvas.dataset.hotspot, "tree");
  assert.deepEqual(hints.at(-1), { zone: "tree", x: 120, y: 80 });
  await renderer.fireEvent(hotspot, "click", { button: 0, delta: 0 });
  assert.deepEqual(entered, ["tree"]);
  gesture.current.dragged = true;
  await renderer.fireEvent(hotspot, "click", { button: 0, delta: 20 });
  assert.equal(entered.length, 1);
  gesture.current.dragged = false;

});


test("wide tree viewing and photography keep the original frame; only messages use close orbit", async (t) => {
  const f = await fixture(t);
  for (const view of [{ mode: "tree", cameraZone: null, treeClose: false }, { mode: "photo", cameraZone: "tree", treeClose: false }]) {
    await f.update(view);
    await f.frames();
    const before = f.state.current.camera.position.clone();
    assert.ok(before.distanceTo(new THREE.Vector3(...CAMERA_PRESETS.tree.pos)) < 1e-8);
    f.pointer("pointerdown"); f.pointer("pointermove", { clientX: 724 }); f.pointer("pointerup", { clientX: 724 });
    await f.frames();
    assert.ok(before.distanceTo(f.state.current.camera.position) < 1e-8);
  }
  await f.update({ mode: "tree", cameraZone: null, treeClose: true });
  await f.frames();
  assert.ok(f.state.current.camera.position.distanceTo(treeCameraPosition(0)) < 1e-8);
  await f.update({ treeClose: false });
  await f.frames();
  assert.ok(f.state.current.camera.position.distanceTo(new THREE.Vector3(...CAMERA_PRESETS.tree.pos)) < 1e-8);
});

test("reduced-motion preference completes camera transfers without automatic travel", async (t) => {
  const previous = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
  try {
    const f = await fixture(t);
    await f.update({ mode: "tree", treeClose: true });
    await f.frames(1);
    assert.ok(f.state.current.camera.position.distanceTo(treeCameraPosition(0)) < 1e-10);
    assert.equal(f.gesture.current.ready, true);
    await f.update({ mode: "pool", poolStep: 2 });
    await f.frames(1);
    assert.ok(f.state.current.camera.position.distanceTo(poolCameraPosition(f.layout, 2)) < 1e-10);
  } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
