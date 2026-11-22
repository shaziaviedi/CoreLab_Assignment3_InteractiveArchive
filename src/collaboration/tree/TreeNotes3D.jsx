import React, { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, Vector3 } from "three";
import { SURVIVOR_TREE } from "../../scene/memorialLayout.js";
import { canActivate } from "../../scene/useInteractionMode.js";
import { INSTALLATION_RADIUS, TREE_NOTE_ANCHORS, TREE_NOTE_BY_ID, anchorFacesCamera } from "./treeNoteLayout.js";
import PaperTag from "./PaperTag.jsx";

export default function TreeNotes3D({ notes, controls, enabled, gesture, hiddenNoteIds, targets, Tag = PaperTag }) {
  const { gl, camera, size } = useThree();
  const point = React.useMemo(() => new Vector3(), []);
  const [hovered, setHovered] = useState(null);
  const placing = enabled && controls.stage === "place" && !controls.pending && !controls.uncertain && controls.status === "connected";
  const occupied = new Set(notes.map((note) => note.anchorId));
  useEffect(() => {
    setHovered(null);
    delete gl.domElement.dataset.treeNote;
    return () => { delete gl.domElement.dataset.treeNote; };
  }, [enabled, controls.stage, placing, gl]);
  useFrame(() => {
    if (!targets) return;
    camera.updateMatrixWorld();
    for (const anchor of TREE_NOTE_ANCHORS) {
      const element = targets.current.get(anchor.id);
      if (!element) continue;
      point.fromArray(anchor.position);
      point.y -= 0.2;
      point.project(camera);
      const visible = enabled && anchorFacesCamera(anchor, camera.position) && point.z >= -1 && point.z <= 1 &&
        Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.92;
      element.hidden = !visible;
      element.tabIndex = visible ? 0 : -1;
      if (visible) element.style.transform = `translate(${(point.x + 1) * size.width / 2}px, ${(1 - point.y) * size.height / 2}px) translate(-50%, -50%)`;
    }
  });
  const clearHover = () => {
    setHovered(null);
    delete gl.domElement.dataset.treeNote;
  };
  const hover = (event, id) => {
    if (!enabled || !gesture.current.ready) return;
    event.stopPropagation();
    setHovered(id);
    gl.domElement.dataset.treeNote = "true";
  };
  return (
    <group name="survivor-message-installation">
      <group position={SURVIVOR_TREE}>
        {[0.81, 1.22].map((height) => (
          <mesh key={height} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null} castShadow receiveShadow>
            <torusGeometry args={[INSTALLATION_RADIUS, 0.012, 6, 96]} />
            <meshStandardMaterial color="#7b7265" roughness={0.65} metalness={0.55} />
          </mesh>
        ))}
        {TREE_NOTE_ANCHORS.slice(0, 12).map((anchor) => (
          <mesh key={anchor.id} position={[Math.sin(anchor.angle) * INSTALLATION_RADIUS, 0.68, Math.cos(anchor.angle) * INSTALLATION_RADIUS]}
            raycast={() => null} castShadow receiveShadow>
            <cylinderGeometry args={[0.014, 0.019, 1.36, 6]} />
            <meshStandardMaterial color="#7b7265" roughness={0.65} metalness={0.55} />
          </mesh>
        ))}
      </group>
      {notes.map((note, index) => {
        const anchor = TREE_NOTE_BY_ID.get(note.anchorId);
        if (!anchor) return null;
        return (
          <group key={note.id} position={anchor.position} rotation={[0, anchor.angle, 0]}>
            <Tag text={hiddenNoteIds?.has(note.id) ? "Message hidden" : note.text} seed={index}
              onPointerOver={(event) => { if (anchorFacesCamera(anchor, camera.position)) hover(event, note.id); }} onPointerOut={clearHover}
              onClick={(event) => {
                event.stopPropagation();
                if (enabled && anchorFacesCamera(anchor, camera.position) && !controls.pending && canActivate(gesture.current, event)) controls.read(note.id);
              }} />
          </group>
        );
      })}
      {placing && TREE_NOTE_ANCHORS.filter((anchor) => !occupied.has(anchor.id)).map((anchor) => (
        <group key={anchor.id} position={anchor.position} rotation={[0, anchor.angle, 0]}>
          {/* R3F raycasts these discrete surfaces and delivers the nearest hit. */}
          <mesh position={[0, -0.18, 0.035]}
            onPointerOver={(event) => { if (anchorFacesCamera(anchor, camera.position)) hover(event, anchor.id); }} onPointerOut={clearHover}
            onClick={(event) => {
              event.stopPropagation();
              if (anchorFacesCamera(anchor, camera.position) && canActivate(gesture.current, event)) controls.place(anchor.id);
            }}>
            <planeGeometry args={[0.42, 0.42]} />
            <meshBasicMaterial color="#fff1cf" side={DoubleSide} transparent
              opacity={hovered === anchor.id || controls.focusedAnchorId === anchor.id ? 0.14 : 0.035} depthWrite={false} />
          </mesh>
          <mesh raycast={() => null}>
            <torusGeometry args={[0.027, 0.004, 5, 20]} />
            <meshBasicMaterial color="#ffebbd" transparent opacity={hovered === anchor.id || controls.focusedAnchorId === anchor.id ? 0.85 : 0.35} />
          </mesh>
          {(hovered === anchor.id || controls.focusedAnchorId === anchor.id) && <Tag text={controls.draft.trim()} preview />}
        </group>
      ))}
    </group>
  );
}
