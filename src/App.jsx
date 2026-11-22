import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import LoadingScreen from "./scene/LoadingScreen.jsx";
import CollaborationProvider, { useCollaboration } from "./collaboration/CollaborationProvider.jsx";
import VisitorEntry from "./collaboration/components/VisitorEntry.jsx";
import CollaborationStatus from "./collaboration/components/CollaborationStatus.jsx";

const Experience = lazy(() => import("./Experience.jsx"));

export default function App() {
  return (
    <CollaborationProvider>
      <MemorialApp />
    </CollaborationProvider>
  );
}

function MemorialApp() {
  const { identity, updateIdentity } = useCollaboration();
  const [editingProfile, setEditingProfile] = useState(false);
  const [phase, setPhase] = useState("landing");
  const [sceneReady, setSceneReady] = useState(false);
  const [entryRequested, setEntryRequested] = useState(false);
  const sceneRef = useRef(null);
  useEffect(() => {
    if (entryRequested && sceneReady) setPhase("entering");
  }, [entryRequested, sceneReady]);

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
        inert={phase !== "entered" || editingProfile ? "" : undefined}
        aria-hidden={phase !== "entered" || editingProfile}
      >
        <Suspense fallback={<LoadingScreen />}>
          <Experience preview={phase !== "entered"} interactionBlocked={editingProfile} onSceneReady={setSceneReady} />
        </Suspense>
      </div>
      {(!identity || editingProfile) && (
        <VisitorEntry
          identity={identity}
          onCancel={editingProfile ? () => setEditingProfile(false) : undefined}
          onSave={(profile) => {
            if (!updateIdentity(profile)) return false;
            if (editingProfile) setEditingProfile(false);
            else setEntryRequested(true);
            return true;
          }}
        />
      )}
      {identity && phase !== "entered" && !editingProfile && (
        <main className="landing">
          <div className="landing-content">
            <p className="landing-eyebrow">An interactive memorial study</p>
            <h1>Elsewhere.</h1>
            <p className="landing-description">
              A different rhythm within the city.
            </p>
            <button
              className="landing-enter"
              disabled={phase === "entering" || (entryRequested && !sceneReady)}
              onClick={() => setEntryRequested(true)}
            >
              {entryRequested && !sceneReady ? "Preparing the memorial" : "Enter the experience"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </main>
      )}
      {identity && phase === "entered" && (
        <div inert={editingProfile ? "" : undefined} aria-hidden={editingProfile}>
          <CollaborationStatus onEdit={() => setEditingProfile(true)} />
        </div>
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
