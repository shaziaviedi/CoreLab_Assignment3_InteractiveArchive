import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { useThree } from "@react-three/fiber";
import { renderToStaticMarkup } from "react-dom/server";
import useHiddenNotes, { hiddenNotesKey, readHiddenNotes } from "../../src/collaboration/tree/useHiddenNotes.js";
import TreeNotes3D from "../../src/collaboration/tree/TreeNotes3D.jsx";
import TreeNotePanel from "../../src/collaboration/tree/TreeNotePanel.jsx";
import TreeNoteAccessibility from "../../src/collaboration/tree/TreeNoteAccessibility.jsx";
import { KEYBOARD_NOTE_ANCHORS } from "../../src/collaboration/tree/treeNoteLayout.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("note hiding is local, room-scoped, reversible and tolerant of blocked storage", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  let state;
  function Probe({ roomId }) { state = useHiddenNotes(roomId); return null; }
  try {
    const renderer = await create(React.createElement(Probe, { roomId: "room-a" }));
    await act(async () => state.hideNote("note-1"));
    assert.equal(state.hiddenNoteIds.has("note-1"), true);
    assert.deepEqual(JSON.parse(saved.get(hiddenNotesKey("room-a"))), ["note-1"]);
    await renderer.update(React.createElement(Probe, { roomId: "room-b" }));
    assert.equal(state.hiddenNoteIds.has("note-1"), false);
    await renderer.update(React.createElement(Probe, { roomId: "room-a" }));
    assert.equal(state.hiddenNoteIds.has("note-1"), true);
    await act(async () => state.showNote("note-1"));
    assert.equal(state.hiddenNoteIds.size, 0);
    storage.setItem = () => { throw new Error("Storage blocked"); };
    await act(async () => state.hideNote("note-2"));
    assert.equal(state.hiddenNoteIds.has("note-2"), true);
    assert.match(state.warning, /this visit/);
    await renderer.unmount();
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
  assert.equal(readHiddenNotes("room", { getItem: () => "invalid-json" }).size, 0);
  assert.equal(readHiddenNotes("room", { getItem: () => JSON.stringify([12, null, "", "x".repeat(81), "valid-id"]) }).size, 1);
});

test("hidden tags still occupy their anchors and keyboard focus previews only visible points", async () => {
  const note = { id: "hidden-note", anchorId: "tree-01", text: "Content a visitor chose to hide.", authorName: "Author" };
  const hiddenNoteIds = new Set([note.id]);
  const front = KEYBOARD_NOTE_ANCHORS[65], rear = KEYBOARD_NOTE_ANCHORS[80];
  const elements = new Map([front, rear].map((anchor) => [anchor.id, { hidden: true, style: {}, tabIndex: -1 }]));
  const controls = { stage: "place", status: "connected", focusedAnchorId: front.id, draft: "Remembered.", pending: false, uncertain: false, place: () => {}, read: () => {}, focusAnchor: () => {} };
  const gesture = { current: { ready: true, pointers: 0, dragged: false, fragmentDragging: false } };
  const Tag = (props) => React.createElement("mesh", { ...props, name: props.preview ? "tag-preview" : "tag" });
  function Aim() { const camera = useThree((state) => state.camera); camera.lookAt(-3, 1.05, 9.92); camera.updateMatrixWorld(); return null; }
  const renderer = await create(React.createElement(React.Fragment, null, React.createElement(Aim),
    React.createElement(TreeNotes3D, { notes: [note], controls, hiddenNoteIds, targets: { current: elements }, enabled: true, gesture, Tag })), {
    camera: { position: [-3, 1.7, 13.12], fov: 46 }, beforeReturn: (canvas) => { canvas.dataset = {}; canvas.style.setProperty = () => {}; },
  });
  await renderer.advanceFrames(1, 1 / 60);
  assert.equal(elements.get(front.id).hidden, false);
  assert.equal(elements.get(rear.id).hidden, true);
  const targets = renderer.scene.findAll((node) => typeof node.props.onClick === "function");
  assert.equal(targets.length, 2, "one continuous fence surface plus one hidden-but-occupied message");
  assert.equal(renderer.scene.findAll((node) => node.props.text === note.text).length, 0);
  assert.equal(renderer.scene.findAll((node) => node.props.name === "tag-preview").length, 1);
  await renderer.unmount();
  const moderation = { hiddenNoteIds, showNote: () => {}, hideNote: () => {} };
  const html = renderToStaticMarkup(React.createElement(TreeNotePanel, { controls: { ...controls, stage: "read", selected: note }, notes: [note], moderation, active: true }));
  assert.match(html, /Message hidden on this browser/);
  assert.match(html, /Show this message/);
  assert.doesNotMatch(html, /Content a visitor chose to hide/);
  const access = renderToStaticMarkup(React.createElement(TreeNoteAccessibility, { notes: [note], controls, active: true, targets: { current: new Map() }, hiddenNoteIds }));
  assert.match(access, /Read hidden message at point 1/);
  assert.match(access, /Attach your message at point 2/);
  assert.doesNotMatch(access, /Content a visitor chose to hide/);
  assert.equal(note.text, "Content a visitor chose to hide.", "hiding never modifies authoritative notes");
});
