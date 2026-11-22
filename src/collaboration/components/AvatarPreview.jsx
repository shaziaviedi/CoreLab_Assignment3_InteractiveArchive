import React, { Component, Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import AnimatedVisitor from "../../AnimatedVisitor.jsx";

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
          <Suspense fallback={null}><IdleAvatar avatarType={avatarType} /></Suspense>
        </Canvas>
      </PreviewBoundary>
    </span>
  );
}
