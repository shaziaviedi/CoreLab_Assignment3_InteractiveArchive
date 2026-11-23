import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, PlaneGeometry } from "three";
import useReducedMotion from "../../scene/useReducedMotion.js";
import { createPaperTexture } from "./paperTexture.js";

export default function PaperTag({ text, seed = 0, preview = false, ...events }) {
  const pivot = useRef();
  const arrival = useRef(0);
  const reduced = useReducedMotion();
  const texture = useMemo(() => createPaperTexture(text), [text]);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(0.34, 0.43, 6, 10);
    const positions = plane.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), y = positions.getY(index);
      positions.setZ(index, Math.sin(y * 19) * 0.004 + x * x * 0.12);
    }
    plane.computeVertexNormals();
    return plane;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }, dt) => {
    arrival.current = Math.min(1, arrival.current + dt * 1.6);
    if (!pivot.current) return;
    // Attach at the top, then settle; the anchor itself never moves with the camera.
    const remaining = reduced || preview ? 0 : (1 - arrival.current) ** 2;
    // Open outward while settling, rather than swinging through the fence posts.
    pivot.current.rotation.x = reduced ? 0 : Math.sin(clock.elapsedTime * 0.7 + seed) * 0.035 - remaining * 0.16;
    pivot.current.rotation.z = reduced ? 0 : Math.sin(clock.elapsedTime * 0.85 + seed * 1.7) * 0.018;
    pivot.current.position.y = remaining * 0.06;
  });
  return (
    <group ref={pivot}>
      <mesh position={[0, -0.022, 0]} raycast={() => null}>
        <torusGeometry args={[0.024, 0.002, 5, 16]} />
        <meshStandardMaterial color="#9e8b6d" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.245, 0.018]} geometry={geometry} castShadow={!preview} receiveShadow {...events}>
        <meshStandardMaterial map={texture} roughness={0.94} side={DoubleSide}
          transparent={preview} opacity={preview ? 0.56 : 1} depthWrite={!preview} />
      </mesh>
      <mesh position={[0.126, -0.426, 0.03]} rotation={[0, 0, Math.PI / 4]} raycast={() => null}>
        <planeGeometry args={[0.055, 0.055]} />
        <meshStandardMaterial color="#dacdb5" side={DoubleSide} roughness={1}
          transparent={preview} opacity={preview ? 0.5 : 1} />
      </mesh>
    </group>
  );
}
