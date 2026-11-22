import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export default function ScenePerformance({ onReady, onSample }) {
  const { gl, scene, camera } = useThree();
  const state = useRef({ frames: 0, seconds: 0, compiling: false, disposed: false });
  useEffect(() => {
    state.current.disposed = false;
    const previous = gl.info.autoReset;
    if (onSample) gl.info.autoReset = false;
    return () => {
      state.current.disposed = true;
      gl.info.autoReset = previous;
    };
  }, [gl, onSample]);
  useFrame((_, dt) => {
    const sample = state.current;
    sample.frames++;
    sample.seconds += dt;
    if (sample.frames >= 2 && !sample.compiling) {
      sample.compiling = true;
      performance.mark("elsewhere:compile-start");
      gl.compileAsync(scene, camera).then(() => {
        if (sample.disposed) return;
        performance.mark("elsewhere:scene-ready");
        performance.measure("elsewhere:gpu-warmup", "elsewhere:compile-start", "elsewhere:scene-ready");
        onReady();
      }).catch(() => {
        // A driver without parallel compilation still completed the first frames.
        if (!sample.disposed) onReady();
      });
    }
    if (onSample) {
      if (sample.seconds >= 2) {
        const resources = performance.getEntriesByType("resource");
        onSample({
          fps: Math.round(sample.frames / sample.seconds),
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          programs: gl.info.programs?.length ?? 0,
          requests: resources.length,
          transferred: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
        });
        sample.frames = 0;
        sample.seconds = 0;
      }
      gl.info.reset();
    }
  }, -100);
  return null;
}
