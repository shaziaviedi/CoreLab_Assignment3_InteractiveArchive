import React, { lazy, Suspense, useEffect, useRef } from "react";
import { limitNote, noteLength } from "./treeNoteLayout.js";

const AvatarPreview = lazy(() => import("../components/AvatarPreview.jsx"));

export function TreeNoteEntry({ controls, disabled }) {
  return (
    <div className="tree-note-entry">
      <button onClick={controls.begin} disabled={disabled}>Leave a message</button>
      <button className="tree-browse-access" onClick={controls.viewMessages} disabled={disabled}>View Messages</button>
    </div>
  );
}

export default function TreeNotePanel({ controls, active, notes, moderation }) {
  const panel = useRef(null);
  const { stage, draft, selected, pending, status, error } = controls;
  useEffect(() => {
    if (!active || (stage !== "compose" && stage !== "read")) return;
    const previous = document.activeElement;
    panel.current?.querySelector("textarea, button")?.focus();
    return () => previous?.isConnected && previous.focus({ preventScroll: true });
  }, [active, stage]);
  if (!active || stage === "idle") return null;
  const connected = status === "connected";
  const hidden = moderation?.hiddenNoteIds.has(selected?.id);
  function key(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      controls.cancel();
    }
    if (event.key !== "Tab" || stage === "place") return;
    const fields = [...panel.current.querySelectorAll("textarea, button:not(:disabled)")];
    const first = fields[0], last = fields.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (stage === "browse") return (
    <section className="tree-placement-guide" aria-label="View messages">
      <p>Drag to look around · select a paper tag to read it</p>
      <button onClick={controls.begin}>Write a message</button>
      <button onClick={controls.cancel}>Back to tree</button>
    </section>
  );
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
        {stage === "compose" ? (
          <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) controls.continueToPlacement(); }}>
            <h2 id="tree-note-heading">A message at the Survivor Tree</h2>
            <label htmlFor="tree-note-text">Your message</label>
            <textarea id="tree-note-text" rows={3} value={draft}
              onChange={(event) => controls.setDraft(limitNote(event.target.value))}
              aria-describedby="tree-note-count" required />
            <small id="tree-note-count">{noteLength(draft)}/180 characters</small>
            <div className="paper-note-preview" aria-label="Paper tag preview">{draft || "A few words to leave here…"}</div>
            {!connected && <p className="tree-note-status">You can write while offline. Reconnect before attaching your tag.</p>}
            <div className="tree-note-actions">
              <button type="submit" disabled={!draft.trim()}>Continue to placement</button>
              <button type="button" onClick={controls.cancel}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <h2 id="tree-note-heading">A message left here</h2>
            {selected ? (
              <>
                <div className="paper-note-preview">{hidden ? "Message hidden on this browser." : selected.text}</div>
                {!hidden && <div className="tree-note-author">
                  <Suspense fallback={<span>{selected.authorAvatar} avatar</span>}>
                    <AvatarPreview avatarType={selected.authorAvatar} />
                  </Suspense>
                  <div><b>{selected.authorName}</b><small>{selected.authorAvatar === "female" ? "Female" : "Male"} avatar</small>
                    <time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString()}</time></div>
                </div>}
                {moderation && <button onClick={() => hidden ? moderation.showNote(selected.id) : moderation.hideNote(selected.id)}>
                  {hidden ? "Show this message" : "Hide this message on this browser"}
                </button>}
                {moderation?.warning && <p role="status">{moderation.warning}</p>}
              </>
            ) : <p>This message is no longer in the room.</p>}
            <button onClick={controls.cancel}>Close message</button>
          </>
        )}
      </section>
    </div>
  );
}
