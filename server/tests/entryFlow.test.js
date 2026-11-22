import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create, act } from "react-test-renderer";
import { PerspectiveCamera, Frustum, Matrix4, Vector3 } from "three";
import { MemorialApp } from "../../src/App.jsx";
import CollaborationProvider from "../../src/collaboration/CollaborationProvider.jsx";
import VisitorEntry from "../../src/collaboration/components/VisitorEntry.jsx";
import AvatarPreview from "../../src/collaboration/components/AvatarPreview.jsx";
import LoadingScreen from "../../src/scene/LoadingScreen.jsx";
import CollaborationStatus from "../../src/collaboration/components/CollaborationStatus.jsx";
import { IDENTITY_KEY } from "../../src/collaboration/identity.js";
import { validateSocketUrl } from "../../src/collaboration/socket.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const Portrait = ({ avatarType }) => React.createElement("span", { "data-portrait": avatarType });
const Entry = (props) => React.createElement(VisitorEntry, { ...props, Preview: Portrait });

for (const returning of [false, true]) test(`${returning ? "returning" : "first"} visitor sees one loader, then introduction, then the appropriate profile stage`, async (t) => {
  const previous = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  const saved = { visitorId: "5bccde1d-7284-4a7d-9f50-27cc986a8498", username: "Remembered", avatarType: "female" };
  const storage = new Map(returning ? [[IDENTITY_KEY, JSON.stringify(saved)]] : []);
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  globalThis.document = { activeElement: null };
  globalThis.window = { location: { search: "?room=entry-review" }, addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let scene, renderer;
  function Scene(props) { scene = props; return React.createElement(CollaborationStatus, { onEdit: props.onEditProfile, Preview: Portrait }); }
  try {
    await act(async () => { renderer = create(React.createElement(CollaborationProvider, null, React.createElement(MemorialApp, { Scene, Entry }))); });
    assert.equal(renderer.root.findAllByType(LoadingScreen).length, 1);
    assert.equal(renderer.root.findAllByType(VisitorEntry).length, 0);
    await act(async () => scene.onSceneReady(true));
    assert.equal(renderer.root.findAllByType(LoadingScreen).length, 0);
    const enter = renderer.root.findByProps({ className: "landing-enter" });
    await act(async () => enter.props.onClick());
    assert.equal(renderer.root.findAllByProps({ className: "arrival-copy" }).length, 1);
    assert.equal(renderer.root.findAllByType(VisitorEntry).length, 0);
    await act(async () => t.mock.timers.tick(4800));
    assert.equal(renderer.root.findAllByType(VisitorEntry).length, returning ? 0 : 1);
    if (!returning) {
      const entry = renderer.root.findByType(Entry);
      await act(async () => entry.props.onSave({ username: "First visitor", avatarType: "male" }));
    }
    assert.equal(scene.preview, false);
    assert.equal(renderer.root.findAllByType(VisitorEntry).length, 0);
    if (returning) assert.deepEqual(JSON.parse(storage.get(IDENTITY_KEY)), saved);
    await act(async () => scene.onEditProfile());
    assert.equal(renderer.root.findAllByType(VisitorEntry).length, 1);
    assert.equal(scene.interactionBlocked, true);
    const text = JSON.stringify(renderer.toJSON());
    assert.doesNotMatch(text, /no account needed|A place is coming into focus|loading-title/);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    t.mock.timers.reset();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

test("avatar portraits frame existing heads and shoulders while excluding feet", () => {
  const portrait = AvatarPreview({ avatarType: "female" });
  const canvas = portrait.props.children.props.children;
  const camera = new PerspectiveCamera(canvas.props.camera.fov, 1, 0.01, 5);
  camera.position.fromArray(canvas.props.camera.position);
  canvas.props.onCreated({ camera });
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  assert.equal(frustum.containsPoint(new Vector3(0, 0.8, 0)), true);
  assert.equal(frustum.containsPoint(new Vector3(0, 0.67, 0)), true);
  assert.equal(frustum.containsPoint(new Vector3(0, 0, 0)), false);
});

test("production socket URLs reject localhost, insecure protocols and non-origin configuration", () => {
  assert.equal(validateSocketUrl("http://localhost:3001").port, "3001");
  assert.equal(validateSocketUrl("https://memorial.onrender.com", true).protocol, "https:");
  for (const url of ["http://memorial.onrender.com", "https://localhost:3001", "https://127.0.0.1", "https://backend.example/socket.io", "https://user:password@backend.example"])
    assert.throws(() => validateSocketUrl(url, true));
});
