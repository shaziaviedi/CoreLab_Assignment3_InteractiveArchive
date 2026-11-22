import React, { useRef } from "react";
import useReducedMotion from "../../scene/useReducedMotion.js";
import { useFrame } from "@react-three/fiber";

export default function WhiteRose({ resources, preview = false, roseColor = "white" }) {
  const rose = useRef();
  const progress = useRef(0);
  const reduced = useReducedMotion();
  const appearance = resources.variants[roseColor] ?? resources.variants.white;
  useFrame((_, dt) => {
    if (!rose.current) return;
    if (preview || reduced) {
      rose.current.position.y = 0;
      rose.current.rotation.x = 0;
      progress.current = 1;
      return;
    }
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + dt * 2);
    const remaining = (1 - progress.current) ** 3;
    rose.current.position.y = remaining * 0.06;
    rose.current.rotation.x = remaining * 0.08;
  });
  return (
    <group ref={rose} dispose={null}>
      {Object.entries(resources.geometries).map(([name, geometry]) => (
        <mesh key={name} geometry={geometry} material={(preview ? appearance.preview : appearance.materials)[name]}
          castShadow={!preview} receiveShadow />
      ))}
    </group>
  );
}
