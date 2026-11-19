import React, { useEffect, useState } from "react";
import { POOL_SIDES } from "../../shared/protocol.js";
import { sideIndex } from "./navigation.js";
import { canActivate } from "./useInteractionMode.js";

export default function PoolPlacementPreview({ layout, step, enabled, gesture, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => setHovered(null), [step, enabled]);
  if (!layout) return null;
  const anchors = layout.anchors.filter((anchor) => anchor.poolSide === POOL_SIDES[sideIndex(step)]);
  return (
    <group>
      {anchors.map((anchor) => (
        <group key={anchor.id} position={anchor.position}>
          <mesh
            position={[0, 0.025, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerOver={(event) => {
              if (!enabled || !gesture.current.ready) return;
              event.stopPropagation();
              setHovered(anchor.id);
            }}
            onPointerOut={() => setHovered(null)}
            onClick={(event) => {
              event.stopPropagation();
              if (!enabled || !canActivate(gesture.current, event)) return;
              setSelected(anchor.id);
              onSelect(anchor);
            }}
          >
            <circleGeometry args={[0.21, 20]} />
            <meshBasicMaterial color="#fff0cd" transparent opacity={enabled ? 0.12 : 0} depthWrite={false} />
          </mesh>
          {(hovered === anchor.id || selected === anchor.id) && (
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <ringGeometry args={[0.075, 0.11, 32]} />
              <meshBasicMaterial color={[1.8, 1.6, 1.2]} transparent opacity={0.7} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
