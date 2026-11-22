import React, { useMemo } from "react";
import { KEYBOARD_NOTE_ANCHORS, noteAnchor } from "./treeNoteLayout.js";
import { notesOverlap } from "../../../shared/fenceLayout.js";

// Read every actual note; offer a coarse focus subset of the finer pointer grid.
export default function TreeNoteAccessibility({ notes, controls, active, targets, hiddenNoteIds }) {
  const entries = useMemo(() => [
    ...notes.map((note) => ({ anchor: noteAnchor(note), note })),
    ...(controls.stage === "place" ? KEYBOARD_NOTE_ANCHORS.filter((anchor) => !notes.some((note) => notesOverlap(note, anchor))).map((anchor) => ({ anchor })) : []),
  ].filter(({ anchor }) => anchor), [notes, controls.stage]);
  if (!active) return null;
  return <div className="tree-note-access">
    {entries.map(({ anchor, note }, index) => <button key={anchor.id} hidden className="tree-note-focus-target"
      ref={(element) => { if (element) targets.current.set(anchor.id, element); else targets.current.delete(anchor.id); }}
      aria-label={note ? `${hiddenNoteIds.has(note.id) ? "Read hidden message" : "Read message"} at point ${index + 1}` : `Attach your message at point ${index + 1}`}
      aria-disabled={controls.pending || (!note && (controls.status !== "connected" || controls.uncertain))}
      onFocus={() => controls.focusAnchor(anchor.id)} onBlur={() => controls.focusAnchor(null)}
      onClick={() => {
        if (controls.pending) return;
        if (note) controls.read(note.id);
        else if (!controls.uncertain && controls.status === "connected") controls.place(anchor.id);
      }}><span>{note ? "Read message" : "Attach message here"}</span></button>)}
  </div>;
}
