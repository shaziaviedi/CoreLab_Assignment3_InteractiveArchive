import React, { useEffect, useRef } from "react";
import { limitNote, noteLength } from "./treeNoteLayout.js";

export default function TreeNotePanel({ controls, active, moderation }) {
  const panel = useRef(null);
  const { stage, draft, selected, pending, status, error } = controls;
  useEffect(() => {
    if (!active || stage !== "compose") return;
    const previous = document.activeElement;
    panel.current?.querySelector("textarea")?.focus();
    return () => previous?.isConnected && previous.focus({ preventScroll: true });
  }, [active, stage]);
  if (!active || stage === "idle" || stage === "arriving") return null;
  const connected = status === "connected";
  function key(event) {
    if (event.key === "Escape") { event.stopPropagation(); controls.cancel(); }
    if (event.key !== "Tab" || stage !== "compose") return;
    const fields = [...panel.current.querySelectorAll("textarea, button:not(:disabled)")];
    const first = fields[0], last = fields.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (stage === "read") {
    const hidden = moderation?.hiddenNoteIds.has(selected?.id);
    return <div className="tree-reading-controls">
      {/* Equivalent full-text access for screen readers; the visual reader is 3D. */}
      <p className="visually-hidden" aria-live="polite">{hidden ? "Message hidden on this browser." : selected?.text}</p>
      <button className="viewer-back" onClick={controls.cancel}>← BACK TO MESSAGES</button>
      {selected && moderation && <button className="viewer-back" onClick={() => hidden ? moderation.showNote(selected.id) : moderation.hideNote(selected.id)}>
        {hidden ? "SHOW MESSAGE" : "HIDE MESSAGE"}
      </button>}
      {moderation?.warning && <p role="status">{moderation.warning}</p>}
    </div>;
  }
  if (stage === "browse") return null;
  if (stage === "place") return (
    <section className="tree-placement-guide" aria-label="Attach your message" onKeyDown={key}>
      <p>{pending ? "Attaching your tag…" : "Move over the fence to choose a position. Drag to look around, or Tab to an attachment point."}</p>
      {!connected && <p role="status">Reconnect to attach your tag. Your draft is kept.</p>}
      {error && <p role="alert">{error}</p>}
      {controls.uncertain && <button onClick={controls.retry} disabled={pending || !connected}>Retry last position</button>}
      <button onClick={controls.edit} disabled={pending || controls.uncertain}>Edit message</button>
      <button onClick={controls.viewMessages} disabled={pending}>View messages</button>
      <button onClick={controls.cancel} disabled={pending}>Cancel</button>
    </section>
  );
  return (
    <div className="tree-note-scrim" onKeyDown={key}>
      <section ref={panel} className="tree-note-panel" role="dialog" aria-modal="true" aria-labelledby="tree-note-heading">
        <form onSubmit={(event) => { event.preventDefault(); controls.continueToPlacement(); }}>
          <h2 id="tree-note-heading">A message at the Survivor Tree</h2>
          <label htmlFor="tree-note-text">Your message</label>
          <textarea id="tree-note-text" rows={3} value={draft}
            onChange={(event) => controls.setDraft(limitNote(event.target.value))}
            aria-describedby="tree-note-count" required />
          <small id="tree-note-count">{noteLength(draft)}/180 characters</small>
          <div className="paper-note-preview" aria-label="Paper tag preview">{draft || "A few words to leave here…"}</div>
          {!connected && <p className="tree-note-status">You can write while offline. Reconnect before attaching your tag.</p>}
          {error && <p role="alert">{error}</p>}
          <div className="tree-note-actions">
            <button type="button" onClick={controls.cancel}>CANCEL</button>
            <button type="submit" disabled={!draft.trim()}>SUBMIT</button>
          </div>
        </form>
      </section>
    </div>
  );
}
