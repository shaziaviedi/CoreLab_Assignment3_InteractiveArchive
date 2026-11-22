import React, { useMemo } from "react";
import { TREE_NOTE_ANCHORS } from "./treeNoteLayout.js";

// Focusable counterparts of the actual tags/attachment points, not another menu.
export default function TreeNoteAccessibility({ notes, controls, active, targets, hiddenNoteIds }) {
  const occupied = useMemo(() => new Map(notes.map((note) => [note.anchorId, note])), [notes]);
  if (!active) return null;
  return (
    <div className="tree-note-access">
      {TREE_NOTE_ANCHORS.map((anchor, index) => {
        const note = occupied.get(anchor.id);
        if (!note && controls.stage !== "place") return null;
        return (
          <button key={anchor.id} hidden className="tree-note-focus-target"
            ref={(element) => { if (element) targets.current.set(anchor.id, element); else targets.current.delete(anchor.id); }}
            aria-label={note ? `${hiddenNoteIds.has(note.id) ? "Read hidden message" : "Read message"} at point ${index + 1}` : `Attach your message at point ${index + 1}`}
            aria-disabled={controls.pending || (!note && (controls.status !== "connected" || controls.uncertain))}
            onFocus={() => controls.focusAnchor(anchor.id)} onBlur={() => controls.focusAnchor(null)}
            onClick={() => {
              if (controls.pending) return;
              if (note) controls.read(note.id);
              else if (!controls.uncertain && controls.status === "connected") controls.place(anchor.id);
            }}>
            <span>{note ? "Read message" : "Attach message here"}</span>
          </button>
        );
      })}
    </div>
  );
}
