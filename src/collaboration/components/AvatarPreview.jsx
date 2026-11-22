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
          camera={{ position: [0, 0.5, 1.65], fov: 35 }}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={2} />
          <directionalLight position={[2, 3, 4]} intensity={2} />
          <group position={[0, -0.43, 0]}>
            <Suspense fallback={null}>
              <IdleAvatar avatarType={avatarType} />
            </Suspense>
          </group>
        </Canvas>
      </PreviewBoundary>
    </span>
  );
}
