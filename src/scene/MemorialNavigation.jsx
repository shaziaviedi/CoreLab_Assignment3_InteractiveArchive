import React from "react";
import { POOL_SIDES } from "../../shared/protocol.js";
import { sideIndex } from "./navigation.js";

export default function MemorialNavigation({ zone, step, transitioning, onStep, onBack, onPhoto }) {
  const index = sideIndex(step);
  return (
    <section className="memorial-navigation" aria-label={`${zone === "tree" ? "Survivor Tree" : "North Pool"} interaction view`}>
      <div className="memorial-view-title">
        <span>{zone === "tree" ? "Survivor Tree" : "North Pool"}</span>
        <small>{transitioning ? "Arriving" : zone === "tree" ? "Drag gently to look around" : "Explore the parapet"}</small>
      </div>
      {zone === "north" && (
        <nav className="pool-side-navigation" aria-label="Pool sides">
          <button aria-label="Previous pool side" onClick={() => onStep(-1)} disabled={transitioning}>‹</button>
          <span aria-live="polite">{index + 1}/4 <small>{POOL_SIDES[index]} side</small></span>
          <button aria-label="Next pool side" onClick={() => onStep(1)} disabled={transitioning}>›</button>
        </nav>
      )}
      <div className="memorial-view-controls">
        <button onClick={onBack}>Back to memorial</button>
        <button onClick={onPhoto} disabled={transitioning}>Photograph this place</button>
      </div>
    </section>
  );
}
