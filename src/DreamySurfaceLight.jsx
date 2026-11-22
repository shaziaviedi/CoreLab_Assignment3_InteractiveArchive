import { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Uniform, Vector3 } from "three";
import { observeObjectTree } from "./scene/objectLifecycle.js";

// view-dependent glints over existing shaders
export default function DreamySurfaceLight({ celestial, lightPosition }) {
  const { scene } = useThree();
  const uniforms = useMemo(
    () => ({
      dreamStrength: new Uniform(0),
      dreamTint: new Uniform(new Color("#fff0cf")),
      dreamDirection: new Uniform(new Vector3()),
    }),
    [],
  );
  const colors = useMemo(
    () => [new Color("#fff0cf"), new Color("#c0d8ff")],
    [],
  );
  useFrame(() => {
    const state = celestial.current;
    const altitude = Math.max(state.sun, state.moon);
    const moon = state.moon > state.sun;
    uniforms.dreamStrength.value =
      state.to === "none"
        ? 0.06
        : Math.max(0, (altitude - 0.2) / 0.8) * (moon ? 0.32 : 0.52);
    uniforms.dreamTint.value.copy(colors[moon ? 1 : 0]);
    uniforms.dreamDirection.value.copy(lightPosition);
    uniforms.dreamDirection.value.y -= 45 * (1 - altitude);
    uniforms.dreamDirection.value.normalize();
  });
  useLayoutEffect(() => {
    const materials = new Map();
    const meshes = new Map();
    function acquire(material) {
      if (materials.has(material)) return materials.get(material);
      const record = (() => {
        const before = material.onBeforeCompile,
          key = material.customProgramCacheKey;
        const programKey = key.call(material);
        material.onBeforeCompile = function (shader, renderer) {
          before.call(this, shader, renderer);
          Object.assign(shader.uniforms, uniforms);
          shader.fragmentShader =
            "uniform float dreamStrength; uniform vec3 dreamTint; uniform vec3 dreamDirection;\n" +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <lights_fragment_end>",
            `#include <lights_fragment_end>
            vec3 dreamView=normalize(vViewPosition);
            vec3 dreamLight=normalize((viewMatrix*vec4(dreamDirection,0.)).xyz);
            vec3 dreamHalf=normalize(dreamView+dreamLight);
            float dreamRim=pow(1.-max(0.,dot(normal,dreamView)),3.);
            float dreamGlint=pow(max(0.,dot(normal,dreamHalf)),mix(48.,18.,roughnessFactor));
            float dreamLit=smoothstep(.005,.12,dot(reflectedLight.directDiffuse,vec3(.2126,.7152,.0722)));
            reflectedLight.directSpecular*=1.+dreamStrength*1.8;
            reflectedLight.directSpecular+=dreamTint*(dreamGlint*.65+dreamRim*.16)*dreamStrength*dreamLit;`,
          );
        };
        material.customProgramCacheKey = () =>
          programKey + "|dream-surface-light-v1";
        material.needsUpdate = true;
        return { before, key, count: 0 };
      })();
      materials.set(material, record);
      return record;
    }
    function release(mesh) {
      const entry = meshes.get(mesh);
      if (!entry) return;
      mesh.onBeforeRender = entry.beforeRender;
      for (const material of entry.used) {
        const record = materials.get(material);
        record.count--;
        if (!record.count) {
          material.onBeforeCompile = record.before;
          material.customProgramCacheKey = record.key;
          material.needsUpdate = true;
          materials.delete(material);
        }
      }
      meshes.delete(mesh);
    }
    return observeObjectTree(scene, (mesh) => {
      if (!mesh.isMesh) return;
      const entry = { beforeRender: mesh.onBeforeRender, used: new Set() };
      meshes.set(mesh, entry);
      mesh.onBeforeRender = function (...args) {
        entry.beforeRender.apply(this, args);
        const material = args[4];
        if (!material?.isMeshStandardMaterial || entry.used.has(material)) return;
        entry.used.add(material);
        acquire(material).count++;
      };
    }, release);
  }, [scene, uniforms]);
  return null;
}
