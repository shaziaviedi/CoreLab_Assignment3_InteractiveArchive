import React, { useState, useEffect, useRef, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import FragmentArt from "./FragmentArt.jsx";
import World3D, { OVERVIEW } from "./World3D.jsx";
import { FRAGMENTS, ZONENAMES, LABELS } from "./data.js";

import { Icon, Slot, ZoneStats, Archive } from "./ExperienceUI.jsx";

export default function Experience({ preview = false }) {
  const [placed, setPlaced] = useState({
    sky: false,
    north: false,
    tree: false,
    street: false,
  });
  const [timeFrag, setTimeFrag] = useState(null);
  const [selected, setSelected] = useState(null);
  const [paused, setPaused] = useState(false);
  const [cameraZone, setCameraZone] = useState(null);
  const [viewReset, setViewReset] = useState(0);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [toastDuration, setToastDuration] = useState(3100);
  const [toastKey, setToastKey] = useState(0);
  const [guideActive, setGuideActive] = useState(false);
  const guideTimer = useRef(null);
  const guideMenuRef = useRef(null);
  const [guideRun, setGuideRun] = useState(0);
  const frameRef = useRef(null);
  const glRef = useRef(null),
    toastTimer = useRef(null),
    overlays = useRef({});
  // camera-linked HTML anchors
  const anchor = (key) => (el) => {
    if (el) overlays.current[key] = el;
    else delete overlays.current[key];
  };
  const period = timeFrag === "moon" ? "evening" : "afternoon";
  const say = useCallback((message, duration = 3100) => {
    setToast(message);
    setToastDuration(duration);
    // restart the toast animation for repeated messages
    setToastKey((key) => key + 1);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), duration);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(guideTimer.current);
      clearTimeout(toastTimer.current);
    },
    [],
  );
  function showInstructions() {
    say(
      "Drag a fragment into its silhouette, then click a camera to enter a visitor's viewpoint.",
      7000,
    );
    setGuideActive(true);
    setGuideRun((run) => run + 1);
    clearTimeout(guideTimer.current);
    guideTimer.current = setTimeout(() => setGuideActive(false), 7000);
  }
  const place = useCallback(
    (fragment, target, dropped = false) => {
      // sky replacement requires a deliberate drag
      if (target === "sky" && placed.sky && !dropped) {
        say("Drag the sun or moon onto the sky to replace it.");
        return;
      }
      if (!fragment) {
        say("Choose a fragment from the lower tray.");
        return;
      }
      const piece = FRAGMENTS.find((p) => p.id === fragment);
      if (!piece || piece.target !== target) {
        say("That fragment belongs elsewhere.");
        return;
      }
      setPlaced((prev) => ({ ...prev, [target]: true }));
      if (target === "sky") setTimeFrag(fragment);
      setSelected(null);
      say(
        target === "sky"
          ? fragment === "moon"
            ? "The night falls."
            : "Afternoon light returns."
          : LABELS[target] +
              (placed.sky
                ? ": observation layer revealed"
                : " placed. Add the sun or moon to reveal observations."),
      );
    },
    [say, placed.sky],
  );
  function choose(p) {
    if (p.target === "sky" && placed.sky) {
      setSelected(null);
      say("Drag the sun or moon onto the sky to replace it.");
      return;
    }
    setSelected(p.id);
    say("Now select the matching glowing silhouette.");
  }
  function shutter() {
    let gl = glRef.current;
    if (!gl) return;
    // canvas capture, without HTML controls
    let url = gl.domElement.toDataURL("image/png");
    const { scene, camera } = frameRef.current;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    let pedestrians = 0;
    const center = new THREE.Vector3();
    scene.traverse((object) => {
      if (!object.userData.pedestrian || !object.visible) return;
      object.getWorldPosition(center);
      // body-height sample for the photo count
      center.y += 0.42;
      if (frustum.containsPoint(center)) pedestrians++;
    });
    setPhotos((old) => [
      ...old,
      {
        id: Date.now(),
        url,
        zone: cameraZone,
        period: placed.sky ? period : null,
        pedestrians,
      },
    ]);
    setFlash(true);
    setTimeout(() => setFlash(false), 650);
    say("One moment, preserved.");
  }
  useEffect(() => {
    function key(e) {
      if (e.key === "Escape") {
        setCameraZone(null);
        setArchiveOpen(false);
        setSelected(null);
        setDockOpen(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <main className="app">
      <div className="three-stage">
        <Canvas
          shadows
          camera={{ position: OVERVIEW.pos, fov: 42, near: 0.1, far: 280 }}
          gl={{
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.5,
          }}
          dpr={[1, 1.8]}
          onCreated={({ gl, scene, camera }) => {
            glRef.current = gl;
            frameRef.current = { scene, camera };
          }}
        >
          <World3D
            placed={placed}
            period={period}
            paused={preview || paused}
            interactive={!preview}
            viewReset={viewReset}
            cameraZone={cameraZone}
            overlays={overlays}
            guideActive={guideActive}
            guideRun={guideRun}
            guideMenuRef={guideMenuRef}
          />
        </Canvas>
      </div>
      <div className="film-grain" />
      <div className="vignette" />
      {!cameraZone && !archiveOpen && (
        <>
          <div className="corner-notation">
            <b>Elsewhere.</b>
            <span>A different rhythm within the city.</span>
          </div>
          {["sky", "north", "tree", "street"].map((id) => (
            <Slot
              key={id}
              id={id}
              placed={placed[id]}
              selected={selected}
              onPlace={place}
              anchorRef={anchor("slot:" + id)}
            />
          ))}
          {["north", "tree", "street"]
            .filter((id) => placed[id])
            .map((id) => (
              <React.Fragment key={id}>
                {hoveredZone === id && (
                  <ZoneStats
                    id={id}
                    period={period}
                    hasObservation={placed.sky}
                    anchorRef={anchor("stats:" + id)}
                  />
                )}
                <button
                  ref={anchor("pin:" + id)}
                  className={"pin " + id}
                  title={"Visit " + ZONENAMES[id]}
                  onMouseEnter={() => setHoveredZone(id)}
                  onMouseLeave={(e) => {
                    if (document.activeElement !== e.currentTarget)
                      setHoveredZone(null);
                  }}
                  onFocus={() => setHoveredZone(id)}
                  onBlur={() => setHoveredZone(null)}
                  onClick={() => {
                    setHoveredZone(null);
                    setCameraZone(id);
                  }}
                >
                  <Icon name="camera" />
                </button>
              </React.Fragment>
            ))}
          <div className="actions">
            <button
              className="button-circle"
              title="Pause or resume the city"
              onClick={() => setPaused((p) => !p)}
            >
              <Icon name={paused ? "play" : "pause"} />
            </button>
            <button
              className="button-circle"
              title="Reset puzzle"
              onClick={() => {
                setPlaced({
                  sky: false,
                  north: false,
                  tree: false,
                  street: false,
                });
                setTimeFrag(null);
                setSelected(null);
                setCameraZone(null);
                setHoveredZone(null);
                setViewReset((value) => value + 1);
                say("The moment begins again.");
              }}
            >
              <Icon name="reset" />
            </button>
          </div>
          <div className="scene-intro">
            <button
              className="button-circle fragment-help"
              title="How to explore"
              aria-label="How to explore"
              onClick={showInstructions}
            >
              <Icon name="info" />
            </button>
            <nav
              ref={guideMenuRef}
              className={
                "fragment-menu" +
                (dockOpen ? " is-open" : "") +
                (guideActive ? " is-guided" : "")
              }
              aria-label="Fragments"
            >
              <button
                className="puzzle-toggle"
                aria-label={dockOpen ? "Close fragments" : "Open fragments"}
                aria-expanded={dockOpen}
                aria-controls="fragment-tray"
                onClick={() => setDockOpen((open) => !open)}
              >
                <Icon name="puzzle" />
              </button>
              <div
                className="fragment-dock"
                id="fragment-tray"
                aria-hidden={!dockOpen}
                inert={!dockOpen ? "" : undefined}
              >
                {FRAGMENTS.map((f, i) => (
                  <React.Fragment key={f.id}>
                    {i === 2 && <div className="dock-divider" />}
                    <button
                      className={
                        "piece " +
                        (selected === f.id ? "chosen " : "") +
                        (placed[f.target] &&
                        (f.target !== "sky" || timeFrag === f.id)
                          ? "placed"
                          : "")
                      }
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", f.id);
                        e.dataTransfer.effectAllowed = "move";
                        const card = e.currentTarget;
                        e.dataTransfer.setDragImage(
                          card,
                          card.offsetWidth / 2,
                          card.offsetHeight / 2,
                        );
                      }}
                      onClick={() => choose(f)}
                      title={"Place " + f.label}
                    >
                      <span className="fragment-art">
                        <FragmentArt fragment={f} />
                      </span>
                      <span className="piece-label">{f.label}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </nav>
          </div>
          {photos.length > 0 && (
            <button
              className="archive-open"
              onClick={() => setArchiveOpen(true)}
            >
              <img
                className="mini-photo"
                src={photos[photos.length - 1].url}
                alt=""
              />
              captured moments · {photos.length}
            </button>
          )}
        </>
      )}
      {cameraZone && !archiveOpen && (
        <>
          <div className="viewer-cover" />
          <div className="viewer-layout">
            <div className="viewer-top">
              <b>{ZONENAMES[cameraZone]}</b>
              <span>{placed.sky ? period : "No observation"}</span>
            </div>
            <div className="viewfinder" />
            <div className="viewer-controls">
              <button
                className="viewer-back"
                onClick={() => setCameraZone(null)}
              >
                ← Return to map
              </button>
              <button
                className="shutter"
                title="Capture this view"
                onClick={shutter}
              />
              <button
                className="viewer-back"
                onClick={() => setArchiveOpen(true)}
              >
                Memories {photos.length}
              </button>
            </div>
          </div>
        </>
      )}
      {archiveOpen && (
        <Archive photos={photos} onClose={() => setArchiveOpen(false)} />
      )}
      {toast && (
        <div
          key={toastKey}
          className="nudge"
          role="status"
          style={{ "--toast-duration": toastDuration + "ms" }}
        >
          {toast}
        </div>
      )}
      {flash && <div className="screen-flash" />}
    </main>
  );
}
