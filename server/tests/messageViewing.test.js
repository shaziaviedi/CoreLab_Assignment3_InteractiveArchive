import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create, act } from "@react-three/test-renderer";
import { create as createUI, act as actUI } from "react-test-renderer";
import useHiddenNotes from "../../src/collaboration/tree/useHiddenNotes.js";
import { useThree } from "@react-three/fiber";
import { renderToStaticMarkup } from "react-dom/server";
import useTreeNotes from "../../src/collaboration/tree/useTreeNotes.js";
import TreeNotes3D from "../../src/collaboration/tree/TreeNotes3D.jsx";
import TreeNotePanel from "../../src/collaboration/tree/TreeNotePanel.jsx";
import TreeNoteAccessibility from "../../src/collaboration/tree/TreeNoteAccessibility.jsx";
import MemorialNavigation from "../../src/scene/MemorialNavigation.jsx";
import { SURVIVOR_TREE } from "../../src/scene/memorialLayout.js";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const note = {
  id: "shared-note",
  anchorId: "tree-01",
  text: "Remembered together.",
  authorName: "Avery",
  createdAt: "2026-11-23T12:00:00.000Z"
};
test("close-up has exactly two actions and returning restores browsing without losing the draft", async t => {
  let controls,
    moving = false,
    submissions = 0;
  const notes = [note];
  function Probe() {
    controls = useTreeNotes({
      active: true,
      notes,
      status: "connected",
      arrived: !moving,
      createNote: () => {
        submissions++;
      },
      onViewChange: () => {
        moving = true;
      }
    });
    return null;
  }
  const renderer = await create(React.createElement(Probe));
  t.after(() => renderer.unmount());
  const navigation = () => renderToStaticMarkup(React.createElement(MemorialNavigation, {
    zone: "tree",
    treeStage: controls.stage,
    transitioning: moving,
    onCompose: controls.begin,
    onBrowse: controls.viewMessages
  }));
  await act(async () => {
    controls.setDraft("An unfinished draft.");
    controls.read(note.id);
  });
  assert.equal(moving, true);
  assert.doesNotMatch(navigation(), /RETURN TO MAP|LEAVE A MESSAGE/);
  assert.equal(renderToStaticMarkup(React.createElement(TreeNotePanel, {
    controls,
    active: !moving
  })), "");
  moving = false;
  await renderer.update(React.createElement(Probe));
  const reader = renderToStaticMarkup(React.createElement(TreeNotePanel, {
    controls,
    active: true
  }));
  assert.equal((reader.match(/<button/g) || []).length, 2);
  assert.match(reader, /← BACK TO MESSAGES/);
  assert.match(reader, /HIDE MESSAGE/);
  assert.doesNotMatch(reader, /RETURN TO MAP|LEAVE A MESSAGE|SHOW MESSAGE|role="dialog"/);
  await act(async () => controls.backToMessages());
  assert.equal(controls.stage, "browse");
  assert.equal(controls.selected, undefined);
  assert.doesNotMatch(navigation(), /RETURN TO MAP|LEAVE A MESSAGE/);
  moving = false;
  await renderer.update(React.createElement(Probe));
  assert.match(navigation(), /RETURN TO MAP/);
  assert.match(navigation(), /LEAVE A MESSAGE/);
  assert.equal(controls.draft, "An unfinished draft.");
  assert.deepEqual(notes, [note]);
  assert.equal(submissions, 0);
});
test("message discovery has a text-only cursor label and keeps keyboard metadata access", () => {
  const controls = {
    stage: "browse",
    info: {
      id: note.id,
      source: "hover"
    }
  };
  const props = {
    notes: [note],
    controls,
    active: true,
    targets: {
      current: new Map()
    },
    hiddenNoteIds: new Set()
  };
  const html = renderToStaticMarkup(React.createElement(TreeNoteAccessibility, props));
  assert.match(html, /<span[^>]*class="tree-view-hint"[^>]*>View Message<\/span>/);
  assert.doesNotMatch(html, /<img|magnify\.svg|<button[^>]*tree-view-hint/);
  assert.match(html, /Read message at point 1/);
  assert.match(html, /Placed by:/);
  const reading = renderToStaticMarkup(React.createElement(TreeNoteAccessibility, {
    ...props,
    controls: {
      ...controls,
      stage: "read",
      selected: note
    }
  }));
  assert.doesNotMatch(reading, /tree-view-hint|Read message at point/);
});
test("the single magnifier label follows the pointer and clears on exit or disabled viewing", async t => {
  const gesture = {
    current: {
      ready: true,
      dragged: false,
      pointers: 0,
      fragmentDragging: false
    }
  };
  const hint = {
    current: {
      hidden: true,
      style: {}
    }
  };
  const controls = {
    stage: "browse",
    info: {
      id: note.id,
      source: "hover"
    },
    showInfo() {},
    hideInfo() {}
  };
  let scene;
  function Probe() {
    scene = useThree();
    return null;
  }
  const Tag = props => React.createElement("mesh", props);
  const element = enabled => React.createElement(React.Fragment, null, React.createElement(TreeNotes3D, {
    notes: [note],
    controls,
    enabled,
    gesture,
    hint,
    Tag
  }), React.createElement(Probe));
  const renderer = await create(element(true), {
    camera: {
      position: [-3, 1.7, 13.12]
    },
    beforeReturn: canvas => {
      canvas.dataset = {};
      canvas.style.setProperty = () => {};
    }
  });
  t.after(() => renderer.unmount());
  scene.camera.lookAt(SURVIVOR_TREE[0], 0.6, SURVIVOR_TREE[2]);
  scene.camera.updateMatrixWorld(true);
  const tag = renderer.scene.findAll(node => typeof node.props.onPointerMove === "function" && !node.props.name)[0];
  for (const [x, y] of [[120, 210], [280, 340]]) {
    await renderer.fireEvent(tag, "pointerMove", {
      clientX: x,
      clientY: y,
      pointerType: "mouse"
    });
    await renderer.advanceFrames(1, 1 / 60);
    assert.equal(scene.gl.domElement.dataset.treeView, "true");
    assert.equal(hint.current.hidden, false);
    assert.equal(hint.current.style.transform, `translate(${x + 24}px, ${y - 16}px)`);
  }
  await renderer.fireEvent(tag, "pointerOut");
  await renderer.advanceFrames(1, 1 / 60);
  assert.equal(hint.current.hidden, true);
  assert.equal(scene.gl.domElement.dataset.treeView, undefined);
  await renderer.update(element(false));
  assert.equal(hint.current.hidden, true);
});
test("Hide censors only the selected Post-it while preserving close-up, other notes and other viewers", async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const saved = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value)
    }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);else delete globalThis.localStorage;
  });
  const other = {
    ...note,
    id: 'other-note',
    anchorId: 'tree-02',
    text: 'Another visitor’s message.'
  };
  const notes = [note, other];
  let controls,
    moderation,
    transitions = 0;
  function Reader() {
    controls = useTreeNotes({
      active: true,
      notes,
      status: 'connected',
      onViewChange: () => transitions++,
      createNote() {
        throw Error('No submission expected');
      }
    });
    moderation = useHiddenNotes('censor-selected-note');
    return React.createElement(TreeNotePanel, {
      controls,
      moderation,
      active: true
    });
  }
  let reader;
  await actUI(async () => {
    reader = createUI(React.createElement(Reader));
  });
  t.after(() => actUI(async () => reader.unmount()));
  await actUI(async () => controls.read(note.id));
  const moveCount = transitions;
  const hide = reader.root.findAllByType('button').find(button => button.children.includes('HIDE MESSAGE'));
  await actUI(async () => hide.props.onClick());
  assert.equal(controls.stage, 'read');
  assert.equal(controls.selected.id, note.id);
  assert.equal(transitions, moveCount, 'censoring does not move the camera');
  assert.deepEqual([...moderation.hiddenNoteIds], [note.id]);
  assert.equal(reader.root.findByProps({
    'aria-live': 'polite'
  }).children.join(''), 'Message hidden on this browser.');
  const Tag = props => React.createElement('mesh', {
    ...props,
    name: 'test-paper'
  });
  const scene = hiddenNoteIds => React.createElement(TreeNotes3D, {
    notes,
    controls,
    hiddenNoteIds,
    enabled: true,
    gesture: {
      current: {
        ready: true
      }
    },
    Tag
  });
  const paper = await create(scene(moderation.hiddenNoteIds), {
    beforeReturn: canvas => {
      canvas.dataset = {};
      canvas.style.setProperty = () => {};
    }
  });
  t.after(() => paper.unmount());
  const texts = () => paper.scene.findAllByProps({
    name: 'test-paper'
  }).map(mesh => mesh.props.text);
  assert.deepEqual(texts(), ['Message hidden', other.text]);
  await paper.update(scene(new Set()));
  assert.deepEqual(texts(), [note.text, other.text], 'another viewer still sees both original messages');
  await actUI(async () => controls.backToMessages());
  assert.equal(controls.stage, 'browse');
  assert.ok(moderation.hiddenNoteIds.has(note.id), 'censorship persists when returning to browsing');
  await actUI(async () => controls.read(note.id));
  const show = reader.root.findAllByType('button').find(button => button.children.includes('SHOW MESSAGE'));
  await actUI(async () => show.props.onClick());
  assert.equal(controls.stage, 'read');
  assert.equal(moderation.hiddenNoteIds.size, 0);
  await paper.update(scene(moderation.hiddenNoteIds));
  assert.deepEqual(texts(), [note.text, other.text]);
  assert.deepEqual(notes, [note, other]);
});
