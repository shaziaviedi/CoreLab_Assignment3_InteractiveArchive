import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, Vector3 } from "three";
import { SURVIVOR_TREE } from "../../scene/memorialLayout.js";
import { canActivate } from "../../scene/useInteractionMode.js";
import { FENCE_GRID, nearestFencePlacement, notesOverlap } from "../../../shared/fenceLayout.js";
import { TREE_INSTALLATION } from "../../../shared/memorialLayout.js";
import {
  INSTALLATION_RADIUS, INSTALLATION_HEIGHTS, TAG_SCALE, NOTE_CENTER_OFFSET,
  TREE_NOTE_ANCHORS, KEYBOARD_NOTE_ANCHORS, noteAnchor, anchorFacesCamera,
} from "./treeNoteLayout.js";
import PaperTag from "./PaperTag.jsx";

export default function TreeNotes3D({ notes, controls, enabled, gesture, hiddenNoteIds, targets, onViewHover, Tag = PaperTag }) {
  const { gl, camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  const wires = useMemo(() => {
    const vertices = [], radius = INSTALLATION_RADIUS;
    const vertex = (column, height) => vertices.push(Math.sin(column / FENCE_GRID.columns * Math.PI * 2) * radius,
      height, Math.cos(column / FENCE_GRID.columns * Math.PI * 2) * radius);
    // A single fine wire lattice supports every permitted attachment position.
    // Keep the original heavier posts/rails and their materials untouched.
    for (let column = 0; column < FENCE_GRID.columns; column++) {
      vertex(column, FENCE_GRID.bottom); vertex(column, TREE_INSTALLATION.upperHeight);
      for (let row = 0; row < FENCE_GRID.rows; row++) {
        const height = FENCE_GRID.bottom + row * FENCE_GRID.step;
        vertex(column, height); vertex(column + 1, height);
      }
    }
    return new Float32Array(vertices);
  }, []);
  const [hovered, setHovered] = useState(null);
  const placing = enabled && controls.stage === "place" && !controls.pending && !controls.uncertain && controls.status === "connected";
  const anchors = useMemo(() => new Map([...KEYBOARD_NOTE_ANCHORS, ...notes.map(noteAnchor).filter(Boolean)].map((anchor) => [anchor.id, anchor])), [notes]);
  const focused = anchors.get(controls.focusedAnchorId);
  const preview = placing && (focused || hovered);
  const blocked = preview && notes.some((note) => notesOverlap(note, preview));
  const previewGroup = useRef(null), previewMotion = useRef(null);
  const clearHover = () => {
    setHovered(null);
    delete gl.domElement.dataset.treeNote;
    delete gl.domElement.dataset.treeView;
    onViewHover?.(null);
  };
  useEffect(() => {
    clearHover();
    gl.domElement.style.setProperty("--memorial-magnify", `url("${import.meta.env?.BASE_URL ?? "/"}svg/magnify.svg") 18 18, pointer`);
    return () => { delete gl.domElement.dataset.treeNote; delete gl.domElement.dataset.treeView; onViewHover?.(null); };
  }, [enabled, controls.stage, gl, onViewHover]);
  useFrame((_, dt) => {
    if (preview && previewGroup.current) {
      const current = previewMotion.current ?? { angle: preview.angle, height: preview.height };
      const delta = Math.atan2(Math.sin(preview.angle - current.angle), Math.cos(preview.angle - current.angle));
      const blend = 1 - Math.exp(-dt * 24);
      current.angle += delta * blend;
      current.height += (preview.height - current.height) * blend;
      previewMotion.current = current;
      // Interpolate along the cylinder, never across its interior or off its face.
      previewGroup.current.position.set(SURVIVOR_TREE[0] + Math.sin(current.angle) * INSTALLATION_RADIUS,
        SURVIVOR_TREE[1] + current.height, SURVIVOR_TREE[2] + Math.cos(current.angle) * INSTALLATION_RADIUS);
      previewGroup.current.rotation.y = current.angle;
    } else previewMotion.current = null;
    if (!targets) return;
    camera.updateMatrixWorld();
    for (const [id, element] of targets.current) {
      const anchor = anchors.get(id);
      let visible = false;
      if (anchor) {
        point.fromArray(anchor.position);
        point.y -= NOTE_CENTER_OFFSET;
        point.project(camera);
        visible = enabled && anchorFacesCamera(anchor, camera.position) && point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.92;
      }
      element.hidden = !visible;
      element.tabIndex = visible ? 0 : -1;
      if (visible) element.style.transform = `translate(${(point.x + 1) * size.width / 2}px, ${(1 - point.y) * size.height / 2}px) translate(-50%, -50%)`;
    }
  });
  function surfacePoint(event) {
    const dx = event.point.x - SURVIVOR_TREE[0], dz = event.point.z - SURVIVOR_TREE[2];
    const placement = nearestFencePlacement(Math.atan2(dx, dz), event.point.y - SURVIVOR_TREE[1]);
    return noteAnchor({ fencePosition: placement.fencePosition });
  }
  function hoverSurface(event) {
    if (!enabled || !gesture.current.ready || gesture.current.dragged) return;
    event.stopPropagation();
    if (placing) {
      setHovered(surfacePoint(event));
      gl.domElement.dataset.treeNote = "true";
    } else if (controls.stage === "idle") {
      gl.domElement.dataset.treeView = "true";
      onViewHover?.({ zone: "messages", x: event.clientX, y: event.clientY });
    }
  }
  return (
    <group name="survivor-message-installation">
      <group position={SURVIVOR_TREE}>
        <lineSegments raycast={() => null}>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[wires, 3]} /></bufferGeometry>
          <lineBasicMaterial color="#7b7265" transparent opacity={0.32} />
        </lineSegments>
        {INSTALLATION_HEIGHTS.map((height) => (
          <mesh key={height} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null} castShadow receiveShadow>
            <torusGeometry args={[INSTALLATION_RADIUS, 0.012, 6, 96]} />
            <meshStandardMaterial color="#7b7265" roughness={0.65} metalness={0.55} />
          </mesh>
        ))}
        {TREE_NOTE_ANCHORS.slice(0, 12).map((anchor) => (
          <mesh key={anchor.id} position={[Math.sin(anchor.angle) * INSTALLATION_RADIUS, TREE_INSTALLATION.postHeight / 2, Math.cos(anchor.angle) * INSTALLATION_RADIUS]}
            raycast={() => null} castShadow receiveShadow>
            <cylinderGeometry args={[0.014, 0.019, TREE_INSTALLATION.postHeight, 6]} />
            <meshStandardMaterial color="#7b7265" roughness={0.65} metalness={0.55} />
          </mesh>
        ))}
        {/* One lightweight raycast surface replaces thousands of anchor meshes. */}
        {enabled && <mesh name="fence-placement-surface" position={[0, (FENCE_GRID.bottom + TREE_INSTALLATION.upperHeight) / 2, 0]}
          onPointerOver={hoverSurface} onPointerMove={hoverSurface} onPointerOut={clearHover}
          onClick={(event) => {
            event.stopPropagation();
            if (!canActivate(gesture.current, event)) return;
            if (placing) {
              const anchor = surfacePoint(event);
              if (!notes.some((note) => notesOverlap(note, anchor))) controls.place(anchor.id);
            } else if (controls.stage === "idle") { clearHover(); controls.viewMessages(); }
          }}>
          <cylinderGeometry args={[INSTALLATION_RADIUS + 0.004, INSTALLATION_RADIUS + 0.004, TREE_INSTALLATION.upperHeight - FENCE_GRID.bottom, 96, 1, true]} />
          <meshBasicMaterial side={DoubleSide} transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>}
      </group>
      {notes.map((note, index) => {
        const anchor = noteAnchor(note);
        if (!anchor) return null;
        return <group key={note.id} position={anchor.position} rotation={[0, anchor.angle, 0]} scale={TAG_SCALE}>
          <Tag text={hiddenNoteIds?.has(note.id) ? "Message hidden" : note.text} seed={index}
            onPointerOver={(event) => { if (enabled) { event.stopPropagation(); setHovered(null); onViewHover?.(null); delete gl.domElement.dataset.treeView; gl.domElement.dataset.treeNote = "true"; } }}
            onPointerMove={(event) => { event.stopPropagation(); onViewHover?.(null); }} onPointerOut={clearHover}
            onClick={(event) => {
              event.stopPropagation();
              if (enabled && anchorFacesCamera(anchor, camera.position) && !controls.pending && canActivate(gesture.current, event)) controls.read(note.id);
            }} />
        </group>;
      })}
      {preview && <group ref={previewGroup} name="fence-note-preview" scale={TAG_SCALE}>
        <Tag text={controls.draft.trim()} preview raycast={() => null} />
        <mesh position={[0, -0.245, 0.03]} raycast={() => null}>
          <planeGeometry args={[0.4, 0.47]} />
          <meshBasicMaterial color={blocked ? "#e79a97" : "#fff1cf"} side={DoubleSide} transparent opacity={blocked ? 0.4 : 0.12} depthWrite={false} />
        </mesh>
      </group>}
    </group>
  );
}
