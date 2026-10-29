import React, {  useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from "three";
import FragmentArt from "./FragmentArt.jsx";
import World3D, { OVERVIEW } from "./World3D.jsx";
import { OBS, FRAGMENTS, ZONENAMES } from "./data.js";

const LABELS = {
  sky: "Sky",
  north: "North Pool",
  tree: "Survivor Tree",
  street: "Greenwich Street"
};

const Icon = ({ name }) => {
  if (name === "camera") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6 10 3h4l2 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/>
      <circle cx="12" cy="12.5" r="3.5"/>
    </svg>
  );
  if (name === "puzzle") {
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4h-2a2 2 0 0 1 0-4h2V9a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-6 0Z"
          />
      </svg>
    );
  }
  const paths = {
    pause: "M7 5h4v14H7zM15 5h4v14h-4z",
    play: "m7 4 13 8-13 8z",
    camera: "M4 7h3l2-3h6l2 3h3v12H4z M12 10a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    reset: "M3 12a9 9 0 1 0 3-7L3 8m0-5v5h5",
    puzzle: "M9 3H4v6h2a2 2 0 1 1 0 4H4v7h6v-2a2 2 0 1 1 4 0v2h6v-7h-2a2 2 0 1 1 0-4h2V3h-6v2a2 2 0 1 1-4 0V3z",
    info: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 10v7M12 7v1",
  };

  return (
    <svg
      width = "17"
      height = "17"
      viewBox = "0 0 24 24"
      stroke = "currentColor"
      strokeWidth = "1.8"
      strokeLinecap = "round"
      strokeLinejoin = "round"
      fill = "none"
    >
      <path d={paths[name]} />
    </svg>
  );
};

function Slot({ id, placed, onPlace, selected, anchorRef }) {
  return (
    <button
      ref = {anchorRef}
      className = {"slot " + id + (placed ? " filled" : "")}
      title = {"Place fragment: " + LABELS[id]}
      aria-label={"Place fragment: " + LABELS[id]}
      onClick={() => onPlace(selected, id)}
      onDragOver = {(e) => e.preventDefault()}
      onDragEnter = {(e) => e.currentTarget.classList.add("dragover")}
      onDragLeave = {(e) => e.currentTarget.classList.remove("dragover")}
      onDrop = {(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("dragover");
        onPlace(e.dataTransfer.getData("text/plain"), id, true);
      }}
    >
    </button>
  );
}

function ZoneStats({ id, period, anchorRef, hasObservation }) {
  if (!hasObservation) return (
    <div ref={anchorRef} className={"data-popup " + id}>
      <label>{ZONENAMES[id]}</label>
      <small className="data-summary">Place the sun or moon to reveal observations.</small>
    </div>
  );
  let d = OBS[period][id];
  return(
    <div ref={anchorRef} className={"data-popup " + id} key={period + "-" + id}>
      <label>{ZONENAMES[id]} · 5 min</label>
      <small className="data-summary">{d.summary}</small>
      <div className="data-numbers">
        <div>
          <strong>{d.crossings}</strong>
          <br />
          <span>crossings</span>
        </div>
        <div>
          <strong>{d.stops}</strong>
          <br />
          <span>new stops</span>
        </div>
      </div>
      <div className="camera-num">
        ✧ <b>{d.photographing}</b> photographing
      </div>
    </div>
  );
}

function Archive({ photos, onClose }){
  return (
    <div className = "archive-panel">
        <div className = "archive-title">Captured moments</div>
        <div className = "archive-photos">What can a photograph remember?</div>
        {photos.length ? (
          <div className="archive-grid">
          {photos.map((a, i) => (
            <article
              className="archive-item"
              key={a.id}
              style={{
                "--rotation": ((i % 2) * 2 - 1) * (2 + (i % 3)) + "deg",
              }}
            >
              <img src={a.url} alt={"Visitor view of " + ZONENAMES[a.zone]} />
              <h3>{ZONENAMES[a.zone]}</h3>
              <p>
                {a.period && a.pedestrians > 0 ? `${a.period === "afternoon" ? "Daytime" : "Evening"} · ${a.pedestrians} pedestrians` : "No observation"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="archive-empty">No moments captured yet.</p>
     )}
      <button className="close-archive" onClick={onClose}>
        Return to the memorial
      </button>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("landing");
  const sceneRef = useRef(null);

  useEffect(() => {
    if (phase !== "entering") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => {
      setPhase("entered");
      sceneRef.current?.focus({ preventScroll: true });
    }, reducedMotion ? 3200 : 4800);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className={"experience-shell " + phase}>
      <div className="experience-scene" ref={sceneRef} tabIndex={-1}
        inert={phase !== "entered" ? "" : undefined}
        aria-hidden={phase !== "entered"}>
        <Experience preview={phase !== "entered"} />
      </div>
      {phase !== "entered" && (
        <main className="landing">
          <div className="landing-content">
            <p className="landing-eyebrow">An interactive memorial study</p>
            <h1>Elsewhere.</h1>
            <p className="landing-description">
              A place within the city, suspended in another rhythm.
            </p>
            <button className="landing-enter" disabled={phase === "entering"}
              onClick={() => setPhase("entering")}>
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
            <i key={i} style={{
              "--x": ((i * 37) % 100) + "%",
              "--y": ((i * 61) % 100) + "%",
              "--drift-x": (((i * 43) % 240) - 120) + "px",
              "--drift-y": (((i * 29) % 240) - 120) + "px",
              "--delay": ((i % 11) * 0.09) + "s",
              "--size": (2 + i % 4) + "px",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Experience({ preview = false }){
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
  const frameRef = useRef(null);
  const glRef = useRef(null),
    toastTimer = useRef(null),
    overlays = useRef({});
  // refs let the 3D scene move the HTML overlays as the camera moves
  const anchor = (key) => (el) => {
    if (el) overlays.current[key] = el;
    else delete overlays.current[key];
  };
  const period = timeFrag === "moon" ? "evening" : "afternoon";
  const say = useCallback((message, duration = 3100) => {
    setToast(message);
    setToastDuration(duration);
    setToastKey(key => key + 1);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), duration);
  }, []);
  useEffect(() => () => {
    clearTimeout(guideTimer.current);
    clearTimeout(toastTimer.current);
  }, []);
  function showInstructions() {
    say("Drag a fragment into its silhouette, then click a camera to enter a visitor's viewpoint.", 7000);
    setGuideActive(true);
    clearTimeout(guideTimer.current);
    guideTimer.current = setTimeout(() => setGuideActive(false), 7000);
  }
  const place = useCallback(
    (fragment, target, dropped = false) => {
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
            ? "The evening enters the memorial."
            : "Afternoon light returns."
          : LABELS[target] + (placed.sky ? ": observation layer revealed" : " placed. Add the sun or moon to reveal observations."),
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
    // grab the 3D canvas only; HTML controls stay out of the photo
    let url = gl.domElement.toDataURL("image/png");
    const { scene, camera } = frameRef.current;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    let pedestrians = 0;
    const center = new THREE.Vector3();
    scene.traverse((object) => {
      if (!object.userData.pedestrian || !object.visible) return;
      object.getWorldPosition(center);
      center.y += .42;
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
          onCreated={({ gl, scene, camera }) => { glRef.current = gl; frameRef.current = { scene, camera }; }}
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
          />
        </Canvas>
      </div>
      <div className="film-grain" />
      <div className="vignette" />
      {!cameraZone && !archiveOpen && (
        <>
          <div className="corner-notation">
            <b>Elsewhere.</b>
            <span>a different rhythm within the city</span>
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
                {hoveredZone === id && <ZoneStats
                  id={id}
                  period={period}
                  hasObservation={placed.sky}
                  anchorRef={anchor("stats:" + id)}
                />}
                <button
                  ref={anchor("pin:" + id)}
                  className={"pin " + id}
                  title={"Visit " + ZONENAMES[id]}
                  onMouseEnter={() => setHoveredZone(id)}
                  onMouseLeave={e => { if (document.activeElement !== e.currentTarget) setHoveredZone(null); }}
                  onFocus={() => setHoveredZone(id)}
                  onBlur={() => setHoveredZone(null)}
                  onClick={() => { setHoveredZone(null); setCameraZone(id); }}
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
                setViewReset(value => value + 1);
                say("The moment begins again.");
              }}
            >
              <Icon name="reset" />
            </button>
            <button
              className="button-circle"
              title="How to explore"
              onClick={showInstructions}
            >
              <Icon name="info" />
            </button>
          </div>
          <div className="scene-intro">
            <nav className={"fragment-menu" + (dockOpen ? " is-open" : "") + (guideActive ? " is-guided" : "")} aria-label="Fragments">
              <button className="puzzle-toggle" aria-label={dockOpen ? "Close fragments" : "Open fragments"}
                aria-expanded={dockOpen} aria-controls="fragment-tray" onClick={() => setDockOpen(open => !open)}>
                <Icon name="puzzle" />
              </button>
              <div className="fragment-dock" id="fragment-tray" aria-hidden={!dockOpen} inert={!dockOpen ? "" : undefined}>
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
                    e.dataTransfer.setDragImage(card, card.offsetWidth / 2, card.offsetHeight / 2);
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
          <div className="viewfinder" />
          <div className="viewer-top">
            <b>{ZONENAMES[cameraZone]}</b>
            <span>{placed.sky ? period : "No observation"} · frame a moment</span>
          </div>
          <div className="viewer-controls">
            <button className="viewer-back" onClick={() => setCameraZone(null)}>
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
        </>
      )}
      {archiveOpen && (
        <Archive photos={photos} onClose={() => setArchiveOpen(false)} />
      )}
      {toast && <div key={toastKey} className="nudge" role="status" style={{"--toast-duration": toastDuration + "ms"}}>{toast}</div>}
      {flash && <div className="screen-flash" />}

    </main>
  );

}
