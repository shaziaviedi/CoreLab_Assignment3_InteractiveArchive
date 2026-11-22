import React, { useEffect, useMemo } from "react";
import { formatFlowerTime } from "./flowerProjection.js";

export default function FlowerOverlay({ layout, side, flowers, controls, active, status, targets, tooltip }) {
  const occupied = useMemo(() => new Map(flowers.map((flower) => [flower.anchorId, flower])), [flowers]);
  const selected = occupied.get(controls.info?.anchorId);
  useEffect(() => {
    // When a focused free anchor becomes occupied, expose its new attribution
    // without requiring the keyboard visitor to leave and refocus the flower.
    for (const [id, element] of targets.current)
      if (element === document.activeElement && occupied.has(id)) controls.showInfo(id, "focus");
  }, [occupied, controls.showInfo, targets]);
  useEffect(() => {
    // A touch label remains readable until the next gesture; it never captures it.
    const dismiss = () => controls.dismissInfo();
    const key = (event) => {
      if (event.key === "Escape" && controls.info) {
        event.stopPropagation();
        controls.dismissInfo();
      }
    };
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [controls.dismissInfo, controls.info]);
  return (
    <div className="flower-overlay">
      {active && layout?.anchors.filter((anchor) => anchor.poolSide === side).map((anchor, index) => (
        <FlowerFocusTarget key={anchor.id} anchor={anchor} index={index} flower={occupied.get(anchor.id)}
          selectedId={selected?.id} controls={controls} status={status} targets={targets} />
      ))}
      {selected && (
        <div ref={tooltip} id="flower-contributor" className="flower-tooltip" role="tooltip" hidden>
          <div className="flower-tooltip-content">
            <span>Placed by: <b>{selected.authorName}</b></span>
            <time dateTime={selected.createdAt}>{formatFlowerTime(selected.createdAt)}</time>
          </div>
        </div>
      )}
      {active && (
        <div className="flower-placement-status" role="status" aria-live="polite">
          {controls.error || (controls.pending ? "Leaving your flower…" : status !== "connected"
            ? "Reconnect to leave a flower." : "Hover a quiet point on the parapet · click to leave a white rose")}
        </div>
      )}
    </div>
  );
}


// This is the flower's focus target, projected over its 3D position. Focusing it
// reveals attribution directly; it is not a separate information control.
export function FlowerFocusTarget({ anchor, index, flower, selectedId, controls, status, targets }) {
  const information = flower ? `Placed by: ${flower.authorName}. ${formatFlowerTime(flower.createdAt)}` : "";
  return (
    <button className="flower-focus-target" hidden
      ref={(element) => { if (element) targets.current.set(anchor.id, element); else targets.current.delete(anchor.id); }}
      aria-label={flower ? `White rose. ${information}` : `Place a white rose at position ${index + 1} on the ${anchor.poolSide} side`}
      aria-describedby={flower && selectedId === flower.id ? "flower-contributor" : undefined}
      aria-disabled={!flower && (controls.pending || status !== "connected")}
      onFocus={() => flower ? controls.showInfo(anchor.id, "focus") : controls.preview(anchor.id)}
      onBlur={() => { controls.hideInfo(anchor.id, "focus"); controls.clearPreview(anchor.id); }}
      onClick={() => flower ? controls.showInfo(anchor.id, "focus") : controls.place(anchor)}>
      <span aria-hidden="true">{flower ? "Rose" : "Leave a flower"}</span>
    </button>
  );
}
