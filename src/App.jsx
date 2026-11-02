import React, { useState, useEffect, useRef } from "react";
import Experience from "./Experience.jsx";

export default function App() {
  const [phase, setPhase] = useState("landing");
  const sceneRef = useRef(null);

  useEffect(() => {
    if (phase !== "entering") return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(
      () => {
        setPhase("entered");
        sceneRef.current?.focus({ preventScroll: true });
      },
      reducedMotion ? 3200 : 4800,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className={"experience-shell " + phase}>
      <div
        className="experience-scene"
        ref={sceneRef}
        tabIndex={-1}
        inert={phase !== "entered" ? "" : undefined}
        aria-hidden={phase !== "entered"}
      >
        <Experience preview={phase !== "entered"} />
      </div>
      {phase !== "entered" && (
        <main className="landing">
          <div className="landing-content">
            <p className="landing-eyebrow">An interactive memorial study</p>
            <h1>Elsewhere.</h1>
            <p className="landing-description">
              A different rhythm within the city.
            </p>
            <button
              className="landing-enter"
              disabled={phase === "entering"}
              onClick={() => setPhase("entering")}
            >
              Enter the experience <span aria-hidden="true">→</span>
            </button>
          </div>
        </main>
      )}
      {phase === "entering" && (
        <div className="arrival-copy" role="status">
          <p>Where the city learns to pause.</p>
          <span>drag fragments into the missing places</span>
        </div>
      )}
      {phase === "entering" && (
        <div className="arrival-sparkles" aria-hidden="true">
          {Array.from({ length: 64 }, (_, i) => (
            <i
              key={i}
              style={{
                "--x": ((i * 37) % 100) + "%",
                "--y": ((i * 61) % 100) + "%",
                "--drift-x": ((i * 43) % 240) - 120 + "px",
                "--drift-y": ((i * 29) % 240) - 120 + "px",
                "--delay": (i % 11) * 0.09 + "s",
                "--size": 2 + (i % 4) + "px",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
