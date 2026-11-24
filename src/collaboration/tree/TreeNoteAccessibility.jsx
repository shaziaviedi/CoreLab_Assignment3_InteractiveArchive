import React, { useMemo } from "react";
import { KEYBOARD_NOTE_ANCHORS, noteAnchor } from "./treeNoteLayout.js";
import { notesOverlap } from "../../../shared/fenceLayout.js";
import { formatFlowerTime } from "../flowers/flowerProjection.js";

// Projected counterparts of the actual tags, plus a coarse keyboard placement grid.
export default function TreeNoteAccessibility({ notes, controls, active, targets, hiddenNoteIds, hint, tooltip }) {
  const entries = useMemo(() => {
    if (["read", "hidden"].includes(controls.stage)) return [];
    const tags = notes.map((note) => ({ anchor: noteAnchor(note), note }));
    if (controls.stage === "place") {
      const available = KEYBOARD_NOTE_ANCHORS.filter((anchor) => !notes.some((note) => notesOverlap(note, anchor)));
      tags.push(...available.map((anchor) => ({ anchor })));
    }
    return tags.filter(({ anchor }) => anchor);
  }, [notes, controls.stage]);
  const indicated = controls.selected ?? notes.find((note) => note.id === controls.info?.id);
  if (!active) return null;
  return <div className="tree-note-access">
    {entries.map(({ anchor, note }, index) => <button key={anchor.id} hidden className="tree-note-focus-target"
      ref={(element) => { if (element) targets.current.set(anchor.id, element); else targets.current.delete(anchor.id); }}
      aria-label={note ? `${hiddenNoteIds.has(note.id) ? "Read hidden message" : "Read message"} at point ${index + 1}` : `Attach your message at point ${index + 1}`}
      aria-describedby={note?.id === indicated?.id ? "note-contributor" : undefined}
      aria-disabled={controls.pending || (!note && (controls.status !== "connected" || controls.uncertain))}
      onFocus={() => { controls.focusAnchor(anchor.id); if (note) controls.showInfo?.(note.id, "focus"); }}
      onBlur={() => { controls.focusAnchor(null); if (note) controls.hideInfo?.(note.id, "focus"); }}
      onClick={() => {
        if (controls.pending) return;
        if (note) controls.read(note.id);
        else if (!controls.uncertain && controls.status === "connected") controls.place(anchor.id);
      }}><span>{note ? "View Message" : "Attach message here"}</span></button>)}
    {indicated && <>
      {/* The canvas supplies the single native magnifier; only its label is HTML. */}
      {controls.stage !== "read" && <span ref={hint} hidden className="tree-view-hint" aria-hidden="true">View Message</span>}
      <div ref={tooltip} id="note-contributor" className="flower-tooltip" role="tooltip" hidden>
        <div className="flower-tooltip-content"><span>Placed by: <b>{indicated.authorName}</b></span>
          <time dateTime={indicated.createdAt}>{formatFlowerTime(indicated.createdAt)}</time>
        </div>
      </div>
    </>}
  </div>;
}
