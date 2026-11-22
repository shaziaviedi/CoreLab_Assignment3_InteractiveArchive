import React, { Component, Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import AnimatedVisitor from "../../AnimatedVisitor.jsx";
import { createCameraObstacles } from "../../scene/cameraObstacles.js";
import { observeObjectTree } from "../../scene/objectLifecycle.js";
import useReducedMotion from "../../scene/useReducedMotion.js";
import { assignPresencePositions, visitorSeed } from "./presenceLayout.js";
import { projectPresence } from "./presenceVisibility.js";

class AvatarBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function PresenceScene({ peers, layout, labels, enabled }) {
  const { scene } = useThree();
  const registry = useRef(null), assignments = useRef(new Map()), boxes = useRef([]);
  const previous = useRef({});
  useEffect(() => {
    const obstacles = createCameraObstacles(scene);
    registry.current = obstacles;
    return () => { registry.current = null; obstacles.dispose(); };
  }, [scene]);
  useFrame(() => {
    const next = registry.current?.getBoxes(true) ?? boxes.current;
    if (previous.current.peers !== peers || previous.current.layout !== layout || previous.current.boxes !== next) {
      assignments.current = assignPresencePositions(peers, layout, next);
      previous.current = { peers, layout, boxes: next };
      boxes.current = next;
    }
  }, -0.5);
  return (
    <group name="connected-visitor-presence">
      {peers.map((visitor) => <PresenceAvatar key={visitor.socketId} visitor={visitor} assignments={assignments}
        boxes={boxes} labels={labels} enabled={enabled} />)}
    </group>
  );
}

export function PresenceAvatar({ visitor, assignments, boxes, labels, enabled, Avatar = AnimatedVisitor }) {
  const group = useRef(), materials = useRef(new Set());
  const moving = useRef(false), simTime = useRef(0);
  const state = useRef({ opacity: 0, zone: null, point: null });
  const target = useMemo(() => new Vector3(), []), labelPoint = useMemo(() => new Vector3(), []);
  const { camera, size } = useThree();
  const reduced = useReducedMotion();
  useEffect(() => observeObjectTree(group.current, (object) => {
    if (!object.isMesh) return;
    object.raycast = () => null;
    object.castShadow = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.current.add(material);
  }, (object) => {
    if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.current.delete(material);
  }), []);
  useFrame((_, dt) => {
    const root = group.current, current = state.current, location = assignments.current.get(visitor.socketId);
    const label = labels.current.get(visitor.socketId);
    if (!location || !enabled) { root.visible = false; if (label) label.hidden = true; return; }
    if (materials.current.size === 0) { root.visible = false; if (label) label.hidden = true; return; }
    target.fromArray(location);
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8);
    const relocating = current.zone !== null && (current.zone !== visitor.currentZone || root.position.distanceTo(target) > 1.4);
    if (reduced || current.zone === null) {
      root.position.copy(target);
      current.zone = visitor.currentZone;
      if (reduced) current.opacity = 1;
    }
    if (!reduced && relocating) {
      current.opacity *= 1 - k;
      if (current.opacity < 0.025) { root.position.copy(target); current.zone = visitor.currentZone; }
    } else {
      root.position.lerp(target, reduced ? 1 : k);
      current.opacity += (1 - current.opacity) * (reduced ? 1 : k);
    }
    // Nearby bodies fade away from the camera rather than obstructing a tag or rose.
    const clearance = Math.min(1, Math.max(0, (Math.hypot(camera.position.x - root.position.x, camera.position.z - root.position.z) - 1.6) / 1.1));
    const opacity = current.opacity * clearance;
    root.visible = opacity > 0.025;
    for (const material of materials.current) material.opacity = opacity;
    root.rotation.y = visitor.currentZone === "tree" ? Math.atan2(-3 - root.position.x, 9.92 - root.position.z) : Math.PI;
    if (label) {
      camera.updateMatrixWorld();
      labelPoint.copy(root.position);
      labelPoint.y += 1.12;
      current.point = projectPresence(labelPoint, camera, size.width, size.height, boxes.current);
      label.hidden = !root.visible || materials.current.size === 0 || !current.point;
      if (current.point) {
        label.style.transform = `translate(${current.point.x}px, ${current.point.y}px) translate(-50%, -100%)`;
        label.style.opacity = opacity;
      }
    }
  });
  return (
    <group ref={group} userData={{ connectedVisitor: true }}>
      <AvatarBoundary><Suspense fallback={null}>
        <Avatar preview presence female={visitor.avatarType === "female"} moving={moving} simTime={simTime} seed={visitorSeed(visitor.visitorId) % 100} />
      </Suspense></AvatarBoundary>
    </group>
  );
}
