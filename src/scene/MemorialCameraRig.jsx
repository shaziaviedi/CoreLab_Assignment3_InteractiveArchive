import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import useReducedMotion from "./useReducedMotion.js";
import { createCameraObstacles } from "./cameraObstacles.js";
import { OVERVIEW, CAMERA_PRESETS, SURVIVOR_TREE } from "./memorialLayout.js";
import {
  poolCameraPosition, poolCameraTarget, treeCameraPosition,
  safeCameraPosition, transitionPosition, ease, TREE_ORBIT_RADIUS, clearTreeOrbit,
} from "./navigation.js";

// narrow screens: wider lens, then camera setback
// camera controls
const BASE_FOV = 42,
  MAX_FOV = 75,
  FIT_ASPECT = 1.3;
const deg = THREE.MathUtils.degToRad;
export default function MemorialCameraRig({
  cameraZone, mode, poolLayout, poolStep, interactive, viewReset,
  gesture, onTransitionChange,
}) {
  const { camera, gl, scene } = useThree();
  const reduced = useReducedMotion();
  const treeAngle = useRef(0);
  const treeRadius = useRef(TREE_ORBIT_RADIUS);
  const displayedAngle = useRef(0);
  const treeView = mode === "tree" || (mode === "photo" && cameraZone === "tree");
  const obstacles = useRef([]);
  const obstacleCache = useRef(null);
  useEffect(() => {
    const cache = createCameraObstacles(scene);
    obstacleCache.current = cache;
    return () => cache.dispose();
  }, [scene]);
  const transfer = useRef(null);
  const previousView = useRef(null);
  const settled = useRef(false);
  const orbit = useRef({
    yaw: 0,
    pitch: 0,
    zoom: 1,
    focus: new THREE.Vector3(...OVERVIEW.target),
  });
  const spherical = useMemo(() => new THREE.Spherical(), []);
  useEffect(() => {
    Object.assign(orbit.current, { yaw: 0, pitch: 0, zoom: 1 });
    orbit.current.focus.set(...OVERVIEW.target);
  }, [viewReset]);
  useEffect(() => {
    const canvas = gl.domElement;
    if (!interactive || (mode === "photo" && !treeView)) return;
    const pointers = new Map();
    const oldCursor = canvas.style.cursor,
      oldTouch = canvas.style.touchAction;
    canvas.style.cursor = mode === "pool" ? "default" : "grab";
    canvas.style.touchAction = "none";
    const clamp = THREE.MathUtils.clamp;
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const cursor = new THREE.Vector2();
    const groundAt = (x, y) => {
      const rect = canvas.getBoundingClientRect();
      cursor.set(
        ((x - rect.left) / rect.width) * 2 - 1,
        1 - ((y - rect.top) / rect.height) * 2,
      );
      raycaster.setFromCamera(cursor, camera);
      return raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    };
    const limitFocus = () => {
      const focus = orbit.current.focus;
      focus.x = clamp(focus.x, -48, 48);
      focus.z = clamp(focus.z, -48, 38);
      focus.y = clamp(focus.y, 0, 8);
    };
    const zoomAt = (factor, x, y) => {
      const state = orbit.current;
      const next = clamp(state.zoom * factor, 0.12, 1.25);
      const anchor = groundAt(x, y);
      // shift focus toward the ground point under the cursor
      if (anchor)
        state.focus.addScaledVector(
          anchor.sub(state.focus),
          1 - next / state.zoom,
        );
      state.zoom = next;
      limitFocus();
    };
    const pan = (from, to) => {
      const a = groundAt(from.x, from.y),
        b = groundAt(to.x, to.y);
      if (a && b) {
        orbit.current.focus.addScaledVector(a.sub(b), 0.75);
        limitFocus();
      }
    };
    const distance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const midpoint = () => {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      if (!gesture.current.ready) return;
      if (!pointers.size) {
        gesture.current.dragged = false;
        gesture.current.downX = e.clientX;
        gesture.current.downY = e.clientY;
      }
      pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        pan: e.button === 2 || e.shiftKey,
      });
      gesture.current.pointers = pointers.size;
      if (pointers.size > 1) gesture.current.dragged = true;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      if (Math.hypot(e.clientX - gesture.current.downX, e.clientY - gesture.current.downY) >= 6) {
        gesture.current.dragged = true;
        canvas.dataset.dragging = "true";
      }
      if (mode !== "main") {
        const before = pointers.size === 2 ? distance() : 0;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (treeView && pointers.size === 1 && gesture.current.dragged)
          treeAngle.current -= (e.clientX - previous.x) * 0.006;
        if (treeView && pointers.size === 2 && before > 0)
          treeRadius.current = clamp(treeRadius.current * before / Math.max(1, distance()), 2.6, 3.5);
        return;
      }
      const before = pointers.size === 2 ? distance() : 0;
      const oldCenter = pointers.size === 2 ? midpoint() : null;
      const next = { x: e.clientX, y: e.clientY, pan: previous.pan };
      pointers.set(e.pointerId, next);
      if (pointers.size === 2) {
        const after = distance(),
          center = midpoint();
        pan(oldCenter, center);
        if (before > 0 && after > 0)
          zoomAt(Math.pow(before / after, 0.65), center.x, center.y);
      } else if (pointers.size === 1) {
        if (previous.pan) pan(previous, next);
        else {
          orbit.current.yaw = clamp(
            orbit.current.yaw - (e.clientX - previous.x) * 0.0012,
            -0.45,
            0.45,
          );
          orbit.current.pitch = clamp(
            orbit.current.pitch + (e.clientY - previous.y) * 0.0009,
            -0.22,
            0.15,
          );
        }
      }
    };
    const up = (e) => {
      pointers.delete(e.pointerId);
      gesture.current.pointers = pointers.size;
      if (e.type === "pointercancel") gesture.current.dragged = true;
      if (!pointers.size) delete canvas.dataset.dragging;
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = pointers.size ? "grabbing" : mode === "pool" ? "default" : "grab";
    };
    const wheel = (e) => {
      e.preventDefault();
      if (!gesture.current.ready || (mode !== "main" && !treeView)) return;
      const delta =
        e.deltaY *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1);
      if (treeView) treeRadius.current = clamp(treeRadius.current * Math.exp(clamp(delta, -180, 180) * 0.0015), 2.6, 3.5);
      else zoomAt(Math.exp(clamp(delta, -180, 180) * 0.00055), e.clientX, e.clientY);
    };
    const context = (e) => e.preventDefault();
    canvas.addEventListener("contextmenu", context);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("contextmenu", context);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("wheel", wheel);
      for (const id of pointers.keys())
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      gesture.current.pointers = 0;
      delete canvas.dataset.dragging;
      canvas.style.cursor = oldCursor;
      canvas.style.touchAction = oldTouch;
    };
  }, [gl, camera, mode, treeView, interactive, viewReset, gesture]);
  let look = useRef(new THREE.Vector3(...OVERVIEW.target));
  const goal = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (obstacleCache.current) obstacles.current = obstacleCache.current.getBoxes(treeView);
    const s = (cameraZone && CAMERA_PRESETS[cameraZone]) || OVERVIEW;
    const baseFov = treeView ? 46 : mode === "pool" ? 50 : BASE_FOV;
    const halfTan = Math.tan(deg(baseFov / 2)) * Math.max(1, FIT_ASPECT / camera.aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.min(halfTan, Math.tan(deg(MAX_FOV / 2)))));
    aim.set(...s.target);
    goal.set(...s.pos);
    if (mode === "main") {
      const pullBack = Math.max(1, halfTan / Math.tan(deg(MAX_FOV / 2)));
      spherical.setFromVector3(goal.sub(aim).multiplyScalar(pullBack));
      spherical.theta += orbit.current.yaw;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + orbit.current.pitch, 0.5, 1.35);
      spherical.radius *= orbit.current.zoom;
      aim.copy(orbit.current.focus);
      goal.setFromSpherical(spherical).add(aim);
    } else if (treeView) {
      aim.set(SURVIVOR_TREE[0], 1.05, SURVIVOR_TREE[2]);
      // Small angular steps keep rapid drags on a circular path, outside the trunk.
      if (reduced) displayedAngle.current = treeAngle.current;
      else displayedAngle.current += THREE.MathUtils.clamp(
        (treeAngle.current - displayedAngle.current) * (1 - Math.exp(-dt * 9)), -0.08, 0.08,
      );
      treeCameraPosition(displayedAngle.current, goal, treeRadius.current);
      clearTreeOrbit(goal, obstacles.current);
    } else if (mode === "pool" && poolLayout) {
      poolCameraTarget(poolLayout, poolStep, aim);
      poolCameraPosition(poolLayout, poolStep, goal);
    }
    safeCameraPosition(goal, obstacles.current);
    const key = `${mode}:${cameraZone ?? ""}:${poolStep}:${viewReset}`;
    if (previousView.current?.key !== key) {
      const previous = previousView.current;
      transfer.current = {
        start: camera.position.clone(), look: look.current.clone(), elapsed: 0,
        poolFrom: previous?.mode === "pool" && mode === "pool" ? previous.step : null,
      };
      if (transfer.current.poolFrom !== null && poolLayout) {
        let height = Math.max(camera.position.y, goal.y);
        for (let sample = 0; sample <= 32; sample++) {
          poolCameraPosition(poolLayout, THREE.MathUtils.lerp(previous.step, poolStep, sample / 32), position);
          safeCameraPosition(position, obstacles.current);
          height = Math.max(height, position.y);
        }
        transfer.current.poolHeight = height;
      }
      previousView.current = { key, mode, step: poolStep };
      settled.current = false;
      gesture.current.ready = false;
      onTransitionChange(true);
    }
    const transition = transfer.current;
    transition.elapsed = Math.min(1.8, transition.elapsed + Math.min(dt, 0.05));
    const t = reduced ? 1 : transition.elapsed / 1.8;
    if (t < 1) {
      if (transition.poolFrom !== null && poolLayout) {
        // Rise before moving past planting, then descend at the next side.
        const travel = ease(THREE.MathUtils.clamp((t - 0.2) / 0.6, 0, 1));
        const step = THREE.MathUtils.lerp(transition.poolFrom, poolStep, travel);
        poolCameraPosition(poolLayout, step, position);
        position.y = t < 0.2
          ? THREE.MathUtils.lerp(transition.start.y, transition.poolHeight, ease(t / 0.2))
          : t > 0.8
            ? THREE.MathUtils.lerp(transition.poolHeight, goal.y, ease((t - 0.8) / 0.2))
            : transition.poolHeight;
        poolCameraTarget(poolLayout, step, aim);
      } else transitionPosition(transition.start, goal, t, obstacles.current, position);
      camera.position.copy(position);
      look.current.lerpVectors(transition.look, aim, ease(t));
    } else {
      const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 7);
      camera.position.lerp(goal, k);
      safeCameraPosition(camera.position, obstacles.current);
      look.current.lerp(aim, k);
      if (!settled.current) {
        settled.current = true;
        gesture.current.ready = true;
        onTransitionChange(false);
      }
    }
    camera.lookAt(look.current);
    camera.updateProjectionMatrix();
  });
  return null;
}
