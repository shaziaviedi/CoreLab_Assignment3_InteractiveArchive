import React from "react";
import { POOL_VIEW_SIDES, sideIndex } from "./navigation.js";

export default function MemorialNavigation({ zone, step, transitioning, onStep, onBack }) {
  const index = sideIndex(step);
  return (
    <section className="memorial-navigation" aria-label={`${zone === "tree" ? "Survivor Tree" : "North Pool"} interaction view`}>
      <div className="memorial-view-title">
        <span>{zone === "tree" ? "Survivor Tree" : "North Pool"}</span>
      </div>
      {zone === "north" && (
        <nav className="pool-side-navigation" aria-label="Pool sides">
          <button aria-label="Previous pool side" onClick={() => onStep(-1)} disabled={transitioning}>‹</button>
          <span aria-live="polite">{index + 1}/4 <small>{POOL_VIEW_SIDES[index]} side</small></span>
          <button aria-label="Next pool side" onClick={() => onStep(1)} disabled={transitioning}>›</button>
        </nav>
      )}
      <div className="memorial-view-controls">
        <button className="viewer-back" onClick={onBack}>← RETURN TO MAP</button>
      </div>
    </section>
  );
}
