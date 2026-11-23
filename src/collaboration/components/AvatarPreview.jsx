import React, { Component, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import AnimatedVisitor from "../../AnimatedVisitor.jsx";

// Reuse two portrait images in presence lists instead of a WebGL context per peer.
const portraits = new Map();
function portraitEntry(type) {
  if (!portraits.has(type)) portraits.set(type, { url: null, owner: null, listeners: new Set() });
  return portraits.get(type);
}
function CapturePortrait({ avatarType }) {
  const frames = useRef(0);
  const { gl, scene, camera, invalidate } = useThree();
  useFrame(() => {
    const entry = portraitEntry(avatarType);
    if (entry.url) return;
    if (frames.current++ < 2) { invalidate(); return; }
    gl.render(scene, camera);
    entry.url = gl.domElement.toDataURL("image/png");
    entry.listeners.forEach((refresh) => refresh());
  });
  return null;
}

export function AvatarPortrait({ avatarType }) {
  const [url, setUrl] = useState(() => portraitEntry(avatarType).url);
  const [renderPortrait, setRenderPortrait] = useState(false);
  const token = useRef(Symbol("portrait"));
  useEffect(() => {
    const entry = portraitEntry(avatarType);
    function refresh() {
      setUrl(entry.url);
      if (!entry.url && !entry.owner) entry.owner = token.current;
      setRenderPortrait(!entry.url && entry.owner === token.current);
    }
    entry.listeners.add(refresh);
    refresh();
    return () => {
      entry.listeners.delete(refresh);
      if (entry.owner === token.current) {
        entry.owner = null;
        entry.listeners.forEach((listener) => listener());
      }
    };
  }, [avatarType]);
  return url ? <img className="avatar-portrait" src={url} alt="" /> :
    renderPortrait ? <AvatarPreview avatarType={avatarType} /> : <span className="avatar-portrait" aria-hidden="true" />;
}

class PreviewBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <span>Preview unavailable</span> : this.props.children;
  }
}

function IdleAvatar({ avatarType }) {
  const moving = useRef(false);
  const simTime = useRef(0);
  return (
    <group rotation={[0, -0.2, 0]}>
      <AnimatedVisitor
        preview
        female={avatarType === "female"}
        moving={moving}
        simTime={simTime}
        seed={avatarType === "female" ? 2 : 1}
      />
    </group>
  );
}

export default function AvatarPreview({ avatarType }) {
  return (
    <span className="avatar-preview" aria-hidden="true">
      <PreviewBoundary>
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.79, 0.42], fov: 32, near: 0.01, far: 5 }}
          onCreated={({ camera }) => { camera.lookAt(0, 0.775, 0); camera.updateProjectionMatrix(); }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={2} />
          <directionalLight position={[2, 3, 4]} intensity={2} />
          {/* Existing actors are normalized to 0.85 m; crop at head/shoulder height. */}
          <Suspense fallback={null}><IdleAvatar avatarType={avatarType} /><CapturePortrait avatarType={avatarType} /></Suspense>
        </Canvas>
      </PreviewBoundary>
    </span>
  );
}
