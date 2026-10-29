import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function ReferenceMuseum({ night }) {
  const gltf = useLoader(GLTFLoader, import.meta.env.BASE_URL + "models/reference-museum.glb");
  const model = useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const recolor = (source) => {
        const material = source.clone();
        const name = source.name.toLowerCase();
        const glass = name.includes("glass");
        const metal = name.includes("metal");
        const roof = name.includes("barkchips");
        const panels = name.includes("wood");
        const stone = name.includes("stone");
        // slightly different whites keep the roof, cladding + frame readable
        material.map = null;
        material.vertexColors = false;
        material.color.set(
          glass ? (night ? "#579b9e" : "#a4d9d5") :
          metal ? "#d7dee7" : roof ? "#d0d5de" :
          panels ? "#e8ebf0" : stone ? "#c2cad5" : "#eff1f4"
        );
        material.metalness = glass ? .18 : metal ? .65 : .03;
        material.roughness = glass ? .16 : metal ? .3 : roof ? .92 : panels ? .65 : .82;
        material.aoMapIntensity = 1.15;
        material.transparent = glass;
        material.opacity = glass ? .88 : 1;
        material.depthWrite = !glass;
        if (glass) {
          material.onBeforeCompile = (shader) => {
            shader.vertexShader = "varying vec3 windowPoint;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\nwindowPoint=(modelMatrix*vec4(position,1.)).xyz;"
            );
            shader.fragmentShader = "varying vec3 windowPoint;\n" + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <color_fragment>",
              `#include <color_fragment>
              float heightFade=smoothstep(0.,3.8,windowPoint.y);
              float reflection=exp(-pow((windowPoint.y-windowPoint.x*.16-1.4)/.38,2.));
              diffuseColor.rgb*=mix(.72,1.08,heightFade);
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.94,.95),reflection*.38);`
            );
          };
          material.customProgramCacheKey = () => "museum-teal-glass-gradient";
        }
        return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(recolor) : recolor(node.material);
    });
    return scene;
  }, [gltf, night]);
  useEffect(() => () => model.traverse((node) => {
    if (node.isMesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose());
  }), [model]);
  return <group position={[-24.43, 0, 21.14]} scale={1.4}><primitive object={model} /></group>;
}
