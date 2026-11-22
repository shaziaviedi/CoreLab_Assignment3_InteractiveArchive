import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { canActivate } from "../../scene/useInteractionMode.js";
import { createRoseResources } from "./roseGeometry.js";
import { projectFlower } from "./flowerProjection.js";
import WhiteRose from "./WhiteRose.jsx";

export default function PoolFlowers3D({ layout, side, flowers, controls, enabled, infoEnabled,
  gesture, targets, tooltip, Rose = WhiteRose }) {
  const { gl, camera, size } = useThree();
  const resources = useMemo(createRoseResources, []);
  const pointerType = useRef("mouse");
  const occupied = useMemo(() => new Map(flowers.map((flower) => [flower.anchorId, flower])), [flowers]);
  const anchors = useMemo(() => new Map(layout?.anchors.map((anchor) => [anchor.id, anchor]) ?? []), [layout]);
  useEffect(() => () => resources.dispose(), [resources]);
  useEffect(() => {
    controls.clearPreview();
    delete gl.domElement.dataset.flower;
    return () => { delete gl.domElement.dataset.flower; };
  }, [enabled, side, controls.pending, controls.clearPreview, gl]);
  // Project onto the same full-canvas HTML overlay without React state per frame.
  useFrame(() => {
    camera.updateMatrixWorld();
    for (const [id, element] of targets.current) {
      const anchor = anchors.get(id);
      const point = anchor && enabled && anchor.poolSide === side ? projectFlower(anchor, camera, size.width, size.height) : null;
      element.hidden = !point;
      element.tabIndex = point ? 0 : -1;
      if (point) element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
    }
    const anchor = anchors.get(controls.info?.anchorId);
    const point = anchor && infoEnabled ? projectFlower(anchor, camera, size.width, size.height) : null;
    if (tooltip.current) {
      tooltip.current.hidden = !point;
      if (point) {
        const x = Math.max(115, Math.min(size.width - 115, point.x));
        const y = Math.max(80, point.y - 18);
        tooltip.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    }
  });
  if (!layout) return null;
  function hover(event, anchor) {
    if (!gesture.current.ready) return;
    if (occupied.has(anchor.id)) {
      if (!infoEnabled) return;
      event.stopPropagation();
      controls.showInfo(anchor.id);
    } else {
      if (!enabled || anchor.poolSide !== side || controls.pending) return;
      event.stopPropagation();
      controls.preview(anchor.id);
    }
    gl.domElement.dataset.flower = "true";
  }
  return (
    <group name="shared-north-pool-flowers">
      {layout.anchors.map((anchor) => {
        const flower = occupied.get(anchor.id);
        const available = !flower && enabled && anchor.poolSide === side && !controls.pending;
        if (!flower && !available) return null;
        const preview = available && controls.previewId === anchor.id;
        return (
          <group key={flower?.id ?? anchor.id} name={`flower-anchor:${anchor.id}`} position={anchor.position} quaternion={anchor.quaternion}
            onPointerDown={(event) => { pointerType.current = event.pointerType ?? event.nativeEvent?.pointerType ?? "mouse"; }}
            onPointerOver={(event) => hover(event, anchor)}
            onPointerMove={(event) => hover(event, anchor)}
            onPointerOut={() => {
              controls.clearPreview(anchor.id);
              controls.hideInfo(anchor.id);
              delete gl.domElement.dataset.flower;
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (!canActivate(gesture.current, event)) return;
              if (flower && infoEnabled) {
                const source = (event.pointerType ?? event.nativeEvent?.pointerType ?? pointerType.current) === "touch" ? "tap" : "hover";
                controls.showInfo(anchor.id, source);
              } else if (available) controls.place(anchor);
            }}>
            {/* A generous invisible surface makes the narrow stem usable on touch. */}
            <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.44, 0.12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            </mesh>
            {flower && <Rose resources={resources} />}
            {preview && <Rose resources={resources} preview />}
            {available && (
              <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.045, preview ? 0.075 : 0.058, 24]} />
                <meshBasicMaterial color="#fff1d9" transparent opacity={preview ? 0.6 : 0.13} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
