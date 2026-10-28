import React, {  useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from "three";
import World3D, { OVERVIEW } from "./World3D.jsx";
import { OBS, FRAGMENTS, ZONENAMES } from "./data.js";

const LABELS = {
  sky: "Sky",
  north: "North Pool",
  tree: "Survivor Tree",
  street: "Greenwich Street"
};

const Icon = ({ name }) => {
  const paths = {
    pause: "M7 5h4v14H7zM15 5h4v14h-4z",
    play: "m7 4 13 8-13 8z",
    camera: "M4 7h3l2-3h6l2 3h3v12H4z M12 10a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    reset: "M3 12a9 9 0 1 0 3-7L3 8m0-5v5h5",
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

const empties = {
  sky: "day or night", 
  north: "pool", 
  tree: "tree",
  street: "street", 
};

function Slot({ id, placed, onPlace, selected, anchorRef }) {
  return (
    <button
      ref = {anchorRef}
      className = {"slot " + id + (placed ? " filled" : "")}
      title = {"Complete" + LABELS[id]}
      onDragOver = {(e) => e.preventDefault()}
      onDragEnter = {(e) => e.currentTarget.classList.add("dragover")}
      onDragLeave = {(e) => e.currentTarget.classList.remove("dragover")}
      onDrop = {(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("dragover");
        onPlace(e.dataTransfer.getData("text/plain"), id);
      }}
    >
      <span className="slot-icon">
        {id === "sky" ? "☼" : id === "north" ? "≈" : id === "tree" ? "♧" : "⌁"}
      </span>
      <span className="slot-inner">{empties[id]}</span>
    </button>
  );
}

function ZoneStats({ id, period, anchorRef }) {
  let d = OBS[period][id];
  return(
    <div ref={anchorRef} className={"data-popup " + id} key={period + "-" + id}>
      <label>{ZONENAMES[id]} · 5 min</label>
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
                {a.period} · {a.stops} observed stops
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="archive-empty">No moments captured yet.</p>
     )}
           <div className="archive-sub">
        A photograph preserves the moment of looking. What remains beyond its
        frame?
      </div>
      <button className="close-archive" onClick={onClose}>
        Return to the memorial
      </button>
    </div>
  );
}

export default function App(){
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
  const [photos, setPhotos] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState(false);
  const [help, setHelp] = useState(false);
  const glRef = useRef(null),
    toastTimer = useRef(null),
    overlays = useRef({});
  // refs let the 3D scene move the HTML overlays as the camera moves
  const anchor = (key) => (el) => {
    if (el) overlays.current[key] = el;
    else delete overlays.current[key];
  };
  const period = timeFrag === "moon" ? "evening" : "afternoon";
  const say = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3100);
  }, []);
  const place = useCallback(
    (fragment, target) => {
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
          : LABELS[target] + " — observation layer revealed",
      );
    },
    [say],
  );
  function choose(p) {
    if (p.target === "sky" && placed.sky) {
      place(p.id, "sky");
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
    let d = OBS[period][cameraZone];
    setPhotos((old) => [
      ...old,
      {
        id: Date.now(),
        url,
        zone: cameraZone,
        period,
        stops: d.stops,
        crossings: d.crossings,
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
          onCreated={({ gl }) => (glRef.current = gl)}
        >
          <World3D
            placed={placed}
            period={period}
            paused={paused}
            cameraZone={cameraZone}
            overlays={overlays}
          />
        </Canvas>
      </div>
      <div className="film-grain" />
      <div className="vignette" />
      {!cameraZone && !archiveOpen && (
        <>
          <div className="corner-notation">
            <b>E L S E W H E R E</b>
            <span>a different rhythm within the city</span>
          </div>
          <div className="status-pill">
            <span className="dot" />
            {placed.sky
              ? period === "evening"
                ? "EVENING · 6:30–7:00"
                : "AFTERNOON · 1:00–1:40"
              : "A MOMENT UNFINISHED"}
          </div>
          <div className="scene-caption">
            Where the city learns to pause.
            <small>drag fragments into the missing places</small>
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
                <ZoneStats
                  id={id}
                  period={period}
                  anchorRef={anchor("stats:" + id)}
                />
                <button
                  ref={anchor("pin:" + id)}
                  className={"pin " + id}
                  title={"Visit " + ZONENAMES[id]}
                  onClick={() => setCameraZone(id)}
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
                say("The moment begins again.");
              }}
            >
              <Icon name="reset" />
            </button>
            <button
              className="button-circle"
              title="How to explore"
              onClick={() => setHelp((x) => !x)}
            >
              <Icon name="info" />
            </button>
          </div>
          <div className="fragment-dock">
            <div className="dock-sub">
              make the <b>moment</b> whole
            </div>
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
                  }}
                  onClick={() => choose(f)}
                  title={"Place " + f.label}
                >
                  <span className="fragment-art">
                    <img
                      src={
                        import.meta.env.BASE_URL +
                        "svg/" +
                        (f.target === "sky" ? f.id : f.target) +
                        ".svg"
                      }
                      alt={f.label + " fragment"}
                    />
                  </span>
                  <span className="piece-label">{f.label}</span>
                </button>
              </React.Fragment>
            ))}
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
          {help && (
            <div className="nudge" onClick={() => setHelp(false)}>
              Drag a fragment into its silhouette, then click a camera to enter
              a visitor's viewpoint.
            </div>
          )}
        </>
      )}
      {cameraZone && !archiveOpen && (
        <>
          <div className="viewer-cover" />
          <div className="viewfinder" />
          <div className="viewer-top">
            <b>{ZONENAMES[cameraZone]}</b>
            <span>{period} · frame a moment</span>
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
      {toast && <div className="nudge">{toast}</div>}
      {flash && <div className="screen-flash" />}
      <div className="mark-water">
        A STUDY IN MOTION, STILLNESS & REMEMBRANCE
      </div>
    </main>
  );

}
