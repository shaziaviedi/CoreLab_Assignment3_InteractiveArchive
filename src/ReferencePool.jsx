import { useEffect, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import WaterfallParticles from "./WaterfallParticles.jsx";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Color } from "three";

export default function ReferencePool({ at, active, night, guideActive = false, guidancePulse }) {
  const gltf = useLoader(GLTFLoader, import.meta.env.BASE_URL + "models/reference-pool.glb");
  const time = useMemo(() => ({ value: 0 }), []);
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse((node) => {
      if (!node.isMesh) return;
      const part = Number(node.name.match(/pool-part-(\d+)/)?.[1]);
      if (part >= 27) {
        node.visible = false;
        return;
      }
      node.castShadow = active;
      node.receiveShadow = true;
      const recolor = (source) => {
        const material = source.clone();
        material.map = null;
        material.vertexColors = false;
        const water = part === 14;
        const floor = part === 13;
        material.color.set(part === 18 ? "#a79cbb" : part === 16 ? "#080f20" :
          floor ? (night ? "#091327" : "#142746") :
          water ? (night ? "#102b44" : "#1c5367") : "#182338");
        material.metalness = part === 18 ? .35 : .08;
        material.roughness = water ? .3 : part === 18 ? .5 : .85;
        material.transparent = !active;
        material.opacity = active ? 1 : .24;
        material.depthWrite = active;
        if (part === 18) {
          material.emissive.set(active ? "#45394f" : "#000000");
          material.emissiveIntensity = .15;
        }
        if (water || floor) {
          node.geometry.computeBoundingBox();
          const bounds = node.geometry.boundingBox;
          material.onBeforeCompile = (shader) => {
            shader.uniforms.poolTime = time;
            shader.uniforms.poolMin = { value: bounds.min };
            shader.uniforms.poolSize = { value: bounds.getSize(bounds.min.clone()) };
            shader.uniforms.poolGlint = { value: new Color(night ? "#c0d8ff" : "#fff0c9") };
            shader.vertexShader = "varying vec3 poolPoint;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
              "#include <begin_vertex>\npoolPoint=position;");
            shader.fragmentShader = "uniform float poolTime; uniform vec3 poolMin; uniform vec3 poolSize; uniform vec3 poolGlint; varying vec3 poolPoint;\n" + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
              `#include <color_fragment>
              vec2 waterUV=((poolPoint-poolMin)/max(poolSize,vec3(.001))).xz;
              float lightEnd=smoothstep(.1,.95,1.-waterUV.y);
              diffuseColor.rgb*=${floor ? "mix(.65,1.2,lightEnd)" : "mix(.45,1.65,lightEnd)"};
              float ripple=sin(waterUV.y*110.-poolTime*1.7+sin(waterUV.x*35.+poolTime*.5)*1.2);
              float reflectionPath=exp(-pow((waterUV.x-.57+sin(waterUV.y*24.-poolTime*.4)*.025)/.16,2.));
              float glimmer=${floor || !active ? "0." : "reflectionPath*smoothstep(.15,.85,lightEnd)*smoothstep(.3,1.,ripple)"};
              diffuseColor.rgb=mix(diffuseColor.rgb,poolGlint,glimmer*.28);`);
            shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
              "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=poolGlint*glimmer*.12;");
          };
          material.customProgramCacheKey = () => floor ? "reference-navy-floor" : active ? "reference-water-reflections" : "reference-water-placeholder";
        }
        return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(recolor) : recolor(node.material);
    });
    return scene;
  }, [gltf, night, active, time]);
  useFrame((_, dt) => {
    time.value += dt;
    if (!active) model.traverse(node => {
      if (!node.isMesh || !node.visible) return;
      const opacity = guideActive ? .24 * (1 - (guidancePulse?.current ?? 0) * .85) : .24;
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => { material.opacity = opacity; });
    });
  });
  useEffect(() => () => model.traverse((node) => {
    if (node.isMesh && node.visible) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose());
  }), [model]);
  return (
    <group position={at} scale={1.4}>
      <primitive object={model} />
      {active && <WaterfallParticles night={night} />}
    </group>
  );
}
