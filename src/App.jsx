import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import LoadingScreen from "./scene/LoadingScreen.jsx";
import CollaborationProvider, { useCollaboration } from "./collaboration/CollaborationProvider.jsx";
import VisitorEntry from "./collaboration/components/VisitorEntry.jsx";
import useReducedMotion from "./scene/useReducedMotion.js";

const Experience = lazy(() => import("./Experience.jsx"));

export default function App() {
  return <CollaborationProvider><MemorialApp /></CollaborationProvider>;
}

export function MemorialApp({ Scene = Experience, Entry = VisitorEntry }) {
  const { identity, updateIdentity } = useCollaboration();
  const [editingProfile, setEditingProfile] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [sceneReady, setSceneReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const sceneRef = useRef(null), identityRef = useRef(identity);
  identityRef.current = identity;
  const reduced = useReducedMotion();
  const editProfile = useCallback(() => setEditingProfile(true), []);
  // One owner coordinates code/assets/GPU loading, introduction and first profile.
  useEffect(() => {
    if (sceneReady && phase === "loading") setPhase("landing");
  }, [sceneReady, phase]);
  useEffect(() => {
    if (phase !== "entering") return;
    const timer = setTimeout(() => setPhase(identityRef.current ? "entered" : "profile"), reduced ? 3200 : 4800);
    return () => clearTimeout(timer);
  }, [phase, reduced]);
  useEffect(() => {
    if (phase === "entered" && !editingProfile) sceneRef.current?.focus({ preventScroll: true });
  }, [phase, editingProfile]);

  return (
    <div className={"experience-shell " + phase}>
      <div className="experience-scene" ref={sceneRef} tabIndex={-1}
        inert={phase !== "entered" || editingProfile ? "" : undefined}
        aria-hidden={phase !== "entered" || editingProfile}>
        <Suspense fallback={null}>
          <Scene preview={phase !== "entered"} interactionBlocked={editingProfile}
            onSceneReady={setSceneReady} onLoadError={setLoadFailed}
            onEditProfile={editProfile} />
        </Suspense>
      </div>
      {phase === "loading" && <LoadingScreen failed={loadFailed} />}
      {(phase === "profile" || editingProfile) && (
        <Entry identity={identity}
          onCancel={editingProfile ? () => setEditingProfile(false) : undefined}
          onSave={(profile) => {
            if (!updateIdentity(profile)) return false;
            if (editingProfile) setEditingProfile(false);
            else setPhase("entered");
            return true;
          }} />
      )}
      {(phase === "landing" || phase === "entering") && (
        <main className="landing">
          <div className="landing-content">
            <p className="landing-eyebrow">An interactive memorial study</p>
            <h1>Elsewhere.</h1>
            <p className="landing-description">A different rhythm within the city.</p>
            <button className="landing-enter" disabled={phase === "entering"}
              onClick={() => setPhase("entering")}>
              Enter the experience <span aria-hidden="true">→</span>
            </button>
          </div>
        </main>
      )}
      {phase === "entering" && (
        <>
          <div className="arrival-copy" role="status">
            <p>Where the city learns to pause.</p>
            <span>drag fragments into the missing places</span>
          </div>
          <div className="arrival-sparkles" aria-hidden="true">
            {Array.from({ length: 64 }, (_, i) => (
              <i key={i} style={{
                "--x": ((i * 37) % 100) + "%", "--y": ((i * 61) % 100) + "%",
                "--drift-x": ((i * 43) % 240) - 120 + "px", "--drift-y": ((i * 29) % 240) - 120 + "px",
                "--delay": (i % 11) * 0.09 + "s", "--size": 2 + (i % 4) + "px",
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
