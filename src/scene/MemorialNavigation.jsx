import React from "react";
import { POOL_VIEW_SIDES, sideIndex } from "./navigation.js";

export default function MemorialNavigation({
  zone, step, transitioning, onStep, onBack, onCompose, composeDisabled, treeStage, onBrowse,
}) {
  const index = sideIndex(step);
  const isTree = zone === "tree";
  const messagesHidden = isTree && treeStage === "hidden";
  const showControls = !isTree || (!transitioning && !["read", "compose", "arriving"].includes(treeStage));
  return (
    <section className={`memorial-navigation ${isTree ? "tree-navigation" : "pool-navigation"}`} aria-label={`${isTree ? "Survivor Tree" : "North Pool"} interaction view`}>
      <div className="memorial-view-title">
        <span>{isTree ? "Survivor Tree" : "North Pool"}</span>
      </div>
      {zone === "north" && (
        <nav className="pool-side-navigation" aria-label="Pool sides">
          <button aria-label="Previous pool side" onClick={() => onStep(-1)} disabled={transitioning}>‹</button>
          <span aria-live="polite">{index + 1}/4 <small>{POOL_VIEW_SIDES[index]} side</small></span>
          <button aria-label="Next pool side" onClick={() => onStep(1)} disabled={transitioning}>›</button>
        </nav>
      )}
      {showControls && (
        <div className="memorial-view-controls">
          <button className="viewer-back" onClick={onBack}>← RETURN TO MAP</button>
          {messagesHidden && <button className="viewer-back" onClick={onBrowse}>VIEW MESSAGES</button>}
          {!messagesHidden && onCompose && (
            <button className="viewer-back" onClick={onCompose} disabled={composeDisabled}>LEAVE A MESSAGE</button>
          )}
        </div>
      )}
    </section>
  );
}
