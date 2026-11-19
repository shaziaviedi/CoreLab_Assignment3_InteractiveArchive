import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { canActivate } from "./useInteractionMode.js";
import { SURVIVOR_TREE } from "./memorialLayout.js";

export function MemorialHotspot({ zone, enabled, gesture, onEnter, onHover, children }) {
  const { gl } = useThree();
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const base = import.meta.env?.BASE_URL ?? "/";
    gl.domElement.style.setProperty("--memorial-eye", `url("${base}svg/eye.svg") 18 18, pointer`);
    return () => {
      delete gl.domElement.dataset.hotspot;
    };
  }, [gl]);
  useEffect(() => {
    if (!enabled) {
      setHovered(false);
      delete gl.domElement.dataset.hotspot;
      onHover(null);
    }
  }, [enabled, gl, onHover]);
  function hover(event) {
    if (!enabled || !gesture.current.ready || gesture.current.fragmentDragging) return;
    event.stopPropagation();
    setHovered(true);
    gl.domElement.dataset.hotspot = zone;
    onHover({ zone, x: event.clientX, y: event.clientY });
  }
  return (
    <group
      onPointerOver={hover}
      onPointerMove={hover}
      onPointerOut={() => {
        setHovered(false);
        delete gl.domElement.dataset.hotspot;
        onHover(null);
      }}
      onClick={(event) => {
        if (!enabled) return;
        event.stopPropagation();
        if (canActivate(gesture.current, event)) {
          onHover(null);
          setHovered(false);
          delete gl.domElement.dataset.hotspot;
          onEnter(zone);
        }
      }}
    >
      {typeof children === "function" ? children(hovered && enabled) : children}
    </group>
  );
}

export function HotspotGlow({ zone, layout }) {
  const points = useMemo(() => {
    if (!layout) return null;
    const { min, max } = layout.bounds;
    return new Float32Array([
      min.x, max.y + 0.04, min.z, max.x, max.y + 0.04, min.z,
      max.x, max.y + 0.04, max.z, min.x, max.y + 0.04, max.z,
    ]);
  }, [layout]);
  if (zone === "tree") return (
    <mesh position={[SURVIVOR_TREE[0], 0.09, SURVIVOR_TREE[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[1.95, 2, 80]} />
      <meshBasicMaterial color={[1.6, 1.4, 1.05]} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
  return points && (
    <lineLoop raycast={() => null}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
      <lineBasicMaterial color={[1.6, 1.4, 1.05]} transparent opacity={0.55} depthWrite={false} />
    </lineLoop>
  );
}
