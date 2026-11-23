import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import FragmentArt from "./FragmentArt.jsx";
import World3D, { OVERVIEW } from "./World3D.jsx";
import { FRAGMENTS, ZONENAMES, LABELS } from "./data.js";

import { Icon, Slot, ZoneStats, Archive } from "./ExperienceUI.jsx";
import { VisitorZone } from "./collaboration/components/VisitorPresence.jsx";
import useInteractionMode from "./scene/useInteractionMode.js";
import MemorialNavigation from "./scene/MemorialNavigation.jsx";
import { prepareSceneAssets } from "./scene/assets.js";
import CollaborationStatus from "./collaboration/components/CollaborationStatus.jsx";
import ScenePerformance from "./scene/ScenePerformance.jsx";
import { useCollaboration } from "./collaboration/CollaborationProvider.jsx";
import useTreeNotes from "./collaboration/tree/useTreeNotes.js";
import TreeNotes3D from "./collaboration/tree/TreeNotes3D.jsx";
import useHiddenNotes from "./collaboration/tree/useHiddenNotes.js";
import TreeNoteAccessibility from "./collaboration/tree/TreeNoteAccessibility.jsx";
import PresenceScene from "./collaboration/presence/PresenceScene.jsx";
import PresenceLabels from "./collaboration/presence/PresenceLabels.jsx";
import { peerVisitors } from "./collaboration/presence/presenceLayout.js";
import CollaborationNotice from "./collaboration/components/CollaborationNotice.jsx";
import TreeNotePanel from "./collaboration/tree/TreeNotePanel.jsx";
import usePoolFlowers from "./collaboration/flowers/usePoolFlowers.js";
import PoolFlowers3D from "./collaboration/flowers/PoolFlowers3D.jsx";
import FlowerOverlay from "./collaboration/flowers/FlowerOverlay.jsx";
import { POOL_VIEW_SIDES, sideIndex } from "./scene/navigation.js";

export default React.memo(function Experience({ preview = false, interactionBlocked = false, onSceneReady, onLoadError, onEditProfile }) {
  const [assetsReady, setAssetsReady] = useState(false);
  const [gpuReady, setGpuReady] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const profiling = new URLSearchParams(window.location.search).has("profile");
  useEffect(() => {
    let active = true;
    prepareSceneAssets().then(() => {
      if (active) setAssetsReady(true);
    }).catch(() => {
      if (active) onLoadError?.(true);
    });
    return () => { active = false; };
  }, [onLoadError]);
  const markSceneReady = useCallback(() => {
    setGpuReady(true);
    onSceneReady?.(true);
  }, [onSceneReady]);
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
  const [interactionZone, setInteractionZone] = useState(null);
  const [poolStep, setPoolStep] = useState(0);
  const [poolLayout, setPoolLayout] = useState(null);
  const [transitioning, setTransitioning] = useState(true);
  const [hotspotHint, setHotspotHint] = useState(null);
  const gesture = useInteractionMode();
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
  const flashTimer = useRef(null);
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
  const mode = cameraZone ? "photo" : interactionZone === "tree" ? "tree" :
    interactionZone === "north" ? "pool" : "main";
  const sceneInteractive = gpuReady && !preview && !interactionBlocked && !archiveOpen;
  const { notes, createNote, flowers, createFlower, status, visitors, identity, roomId, announcement } = useCollaboration();
  const treeActive = sceneInteractive && interactionZone === "tree" && !cameraZone;
  const treeNotes = useTreeNotes({ active: treeActive, notes, createNote, status, autoCompose: true, arrived: !transitioning && gesture.current.ready });
  // Writing, browsing and cancelling share one orbit; contributions never reset it.
  const treeClose = interactionZone === "tree" && !cameraZone;
  const poolSide = POOL_VIEW_SIDES[sideIndex(poolStep)];
  const flowerActive = sceneInteractive && mode === "pool" && !transitioning;
  const flowerControls = usePoolFlowers({ active: flowerActive, side: poolSide, flowers, createFlower, status });
  const flowerTargets = useRef(new Map());
  const flowerTooltip = useRef(null);
  const moderation = useHiddenNotes(roomId);
  const treeTargets = useRef(new Map());
  const treeHint = useRef(null), treeTooltip = useRef(null);
  const presenceLabels = useRef(new Map());
  const peers = useMemo(() => peerVisitors(visitors, identity?.visitorId), [visitors, identity?.visitorId]);
  const activity = mode === "photo" ? "photographing" : treeActive ? (treeNotes.stage === "compose" ? "writing-note" : treeNotes.stage === "place" ? "placing-note" :
    treeNotes.stage === "read" ? "reading-note" : "idle") : flowerActive && (flowerControls.previewId || flowerControls.pending) ? "placing-flower" : "idle";
  const say = useCallback((message, duration = 3100) => {
    setToast(message);
    setToastDuration(duration);
    // restart the toast animation for repeated messages
    setToastKey((key) => key + 1);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), duration);
  }, []);
  const enterInteraction = useCallback((zone) => {
    setTransitioning(true);
    setInteractionZone(zone);
    setCameraZone(null);
    setSelected(null);
    setDockOpen(false);
    setHoveredZone(null);
    setHotspotHint(null);
  }, []);
  function leavePhoto() {
    setCameraZone(null);
    setInteractionZone(null);
  }
  useEffect(
    () => () => {
      clearTimeout(guideTimer.current);
      clearTimeout(toastTimer.current);
      clearTimeout(flashTimer.current);
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
      if (mode !== "main" || interactionBlocked || archiveOpen) return;
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
    [say, placed.sky, mode, interactionBlocked, archiveOpen],
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
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 650);
    say("One moment, preserved.");
  }
  useEffect(() => {
    function key(e) {
      if (interactionBlocked) return;
      if (treeActive && treeNotes.stage !== "idle") {
        if (e.key === "Escape") treeNotes.cancel();
        return;
      }
      if (e.key === "Escape") {
        if (archiveOpen) {
          setArchiveOpen(false);
          return;
        }
        if (cameraZone) {
          leavePhoto();
          return;
        }
        setInteractionZone(null);
        setCameraZone(null);
        setArchiveOpen(false);
        setSelected(null);
        setDockOpen(false);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [interactionBlocked, archiveOpen, cameraZone, treeActive, treeNotes.stage, treeNotes.cancel]);
  return (
    <main className="app">
      <VisitorZone zone={cameraZone ?? interactionZone ?? "overview"} activity={activity} />
      <div className="three-stage">
        {assetsReady && (
          <Canvas
            shadows="percentage"
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
              interactive={sceneInteractive && !treeNotes.modal}
              mode={mode}
              treeClose={treeClose}
              treeFocus={treeNotes.selected ?? null}
              hasSelectedFragment={Boolean(selected)}
              poolStep={poolStep}
              poolLayout={poolLayout}
              onPoolLayout={setPoolLayout}
              gesture={gesture}
              onEnterInteraction={enterInteraction}
              onHotspotHover={setHotspotHint}
              onTransitionChange={setTransitioning}
              viewReset={viewReset}
              cameraZone={cameraZone}
              overlays={overlays}
              guideActive={guideActive}
              guideRun={guideRun}
              guideMenuRef={guideMenuRef}
            />
            {placed.tree && <TreeNotes3D notes={notes} controls={treeNotes}
              enabled={treeActive && !treeNotes.modal && !transitioning} gesture={gesture} hiddenNoteIds={moderation.hiddenNoteIds} targets={treeTargets}
              hint={treeHint} tooltip={treeTooltip} />}
            {placed.north && <PoolFlowers3D layout={poolLayout} side={poolSide} flowers={flowers}
              controls={flowerControls} enabled={flowerActive}
              infoEnabled={sceneInteractive && !treeNotes.modal && !transitioning}
              gesture={gesture} targets={flowerTargets} tooltip={flowerTooltip} />}
            <PresenceScene peers={peers} layout={poolLayout} labels={presenceLabels} enabled={sceneInteractive} />
            <ScenePerformance onReady={markSceneReady} onSample={profiling ? setMetrics : undefined} />
          </Canvas>
        )}
      </div>
      {profiling && metrics && (
        <output className="scene-metrics">{metrics.fps} FPS · {metrics.calls} draws · {metrics.triangles} triangles · {metrics.programs} programs · {metrics.requests} requests · {(metrics.transferred / 1000000).toFixed(2)} MB transferred</output>
      )}
      <div className="film-grain" />
      <div className="vignette" />
      {mode === "main" && !archiveOpen && (
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
                        if (mode !== "main") {
                          e.preventDefault();
                          return;
                        }
                        gesture.current.fragmentDragging = true;
                        e.dataTransfer.setData("text/plain", f.id);
                        e.dataTransfer.effectAllowed = "move";
                        const card = e.currentTarget;
                        e.dataTransfer.setDragImage(
                          card,
                          card.offsetWidth / 2,
                          card.offsetHeight / 2,
                        );
                      }}
                      onDragEnd={() => { gesture.current.fragmentDragging = false; }}
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
          <nav className="memorial-access" aria-label="Memorial interaction views">
            {placed.tree && <button onClick={() => enterInteraction("tree")} disabled={transitioning}>Leave a message at the Survivor Tree</button>}
            {placed.north && poolLayout && <button onClick={() => enterInteraction("north")} disabled={transitioning}>Leave a flower at the North Pool</button>}
          </nav>
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
      <div className="actions memorial-actions">
        {mode === "main" && !archiveOpen && <>
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
                setInteractionZone(null);
                setHoveredZone(null);
                setViewReset((value) => value + 1);
                say("The moment begins again.");
              }}
            >
              <Icon name="reset" />
            </button>
        </>}
        {!preview && identity && mode === "main" && !archiveOpen && <CollaborationStatus onEdit={onEditProfile} />}
      </div>
      {interactionZone && !cameraZone && !archiveOpen && (
        <MemorialNavigation
          zone={interactionZone}
          step={poolStep}
          transitioning={transitioning}
          onStep={(direction) => {
            if (!transitioning) setPoolStep((step) => step + direction);
          }}
          onBack={() => setInteractionZone(null)}
          onCompose={interactionZone === "tree" ? () => { if (treeNotes.selected) setTransitioning(true); treeNotes.begin(); } : undefined}
          composeDisabled={transitioning || treeNotes.pending || treeNotes.stage === "compose"}
        />
      )}
      {hotspotHint && mode === "main" && !archiveOpen && (
        <div className="memorial-hotspot-hint" style={{ left: Math.min(hotspotHint.x + 22, window.innerWidth - 160), top: Math.max(16, hotspotHint.y - 34) }}>
          {hotspotHint.zone === "tree" ? "Leave a message" : "Leave a flower"}
        </div>
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
                onClick={leavePhoto}
              >
                ← RETURN TO MAP
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
      <TreeNotePanel controls={treeNotes} active={treeActive && !transitioning} notes={notes} moderation={moderation} />
      <TreeNoteAccessibility notes={notes} controls={treeNotes} active={treeActive && !treeNotes.modal && !transitioning}
        targets={treeTargets} hiddenNoteIds={moderation.hiddenNoteIds} hint={treeHint} tooltip={treeTooltip} />
      <PresenceLabels peers={peers} labels={presenceLabels} />
      <CollaborationNotice announcement={announcement} enabled={sceneInteractive && !treeNotes.modal && mode !== "pool" && !(announcement?.kind === "flower" && announcement?.own)} />
      {placed.north && <FlowerOverlay layout={poolLayout} side={poolSide} flowers={flowers}
        controls={flowerControls} active={flowerActive} status={status}
        targets={flowerTargets} tooltip={flowerTooltip} />}
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
});
