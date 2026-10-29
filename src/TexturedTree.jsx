import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

export default function TexturedTree({ position, scale = 1, seed = 12, ghost = false, night = false, survivor = false, bush = false, guideActive = false, guidancePulse }) {
  const autumn = !survivor && !bush && Math.abs(seed) % 5 === 2;
  const asset = survivor ? "survivor-sakura" : bush ? "jabami-bush" : seed % 2 ? "jabami-tree-v1" : "jabami-tree-v4";
  const gltf = useLoader(GLTFLoader, import.meta.env.BASE_URL + "models/" + asset + ".glb");
  const group = useRef();
  const model = useMemo(() => {
    // share geometry + textures, but keep ghost materials separate from the grove
    const scene = gltf.scene.clone(true);
    if (bush) {
      // the bush file contains four separate examples; use one at each planting spot
      const variant = "bush0" + (Math.abs(seed) % 4 + 1);
      const remove = [];
      scene.traverse(node => {
        if (node.isMesh && !node.name.startsWith(variant)) remove.push(node);
      });
      remove.forEach(node => node.removeFromParent());
    }
    scene.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = !ghost;
      node.receiveShadow = true;
      const copy = (source) => {
        const material = source.clone();
        const foliage = bush || /leave|leaf/i.test(source.name);
        const coolCanopy = foliage && !bush && !survivor;
        if (!survivor) {
          node.geometry.computeBoundingBox();
          const bounds = node.geometry.boundingBox;
          material.color.set("#ffffff");
          material.onBeforeCompile = (shader) => {
            shader.uniforms.plantBottom = { value: bounds.min.y };
            shader.uniforms.plantHeight = { value: Math.max(.001, bounds.max.y - bounds.min.y) };
            shader.uniforms.plantShadow = { value: new THREE.Color(coolCanopy && autumn ? "#9b7880" : coolCanopy ? "#4b5969" : foliage ? "#414363" : "#705544") };
            shader.uniforms.plantMid = { value: new THREE.Color(coolCanopy && autumn ? "#e8ae86" : coolCanopy ? "#7fa56d" : foliage ? "#75a650" : "#ad8765") };
            shader.uniforms.plantLight = { value: new THREE.Color(coolCanopy && autumn ? "#f2dfa0" : coolCanopy ? "#e0eb9b" : foliage ? "#d9ef8e" : "#cfac83") };
            shader.uniforms.canopyCenter = { value: bounds.getCenter(new THREE.Vector3()) };
            shader.vertexShader = "varying float plantY; uniform vec3 canopyCenter;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
              "#include <begin_vertex>\nplantY=position.y;\n" +
              (coolCanopy ? "transformed=canopyCenter+(transformed-canopyCenter)*vec3(1.2,1.1,1.2);" : ""));
            shader.fragmentShader = "varying float plantY; uniform float plantBottom; uniform float plantHeight; uniform vec3 plantShadow; uniform vec3 plantMid; uniform vec3 plantLight;\n" + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
              `#include <color_fragment>
              float textureShade=pow(clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),0.,1.),.45);
              float heightShade=clamp((plantY-plantBottom)/plantHeight,0.,1.);
              float shade=clamp(textureShade*.72+heightShade*.28-${coolCanopy ? ".08" : "0."},0.,1.);
              diffuseColor.rgb=mix(plantShadow,plantMid,smoothstep(.12,.62,shade));
              diffuseColor.rgb=mix(diffuseColor.rgb,plantLight,smoothstep(${coolCanopy ? ".54,.9" : ".62,.96"},shade));`);
            // retain the painted shading without daylight bleaching the leaf colours
            if (foliage) shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>",
              "outgoingLight=mix(diffuseColor.rgb,min(outgoingLight,diffuseColor.rgb*1.5),.15);\n#include <opaque_fragment>");
          };
          material.customProgramCacheKey = () => coolCanopy ? "jabami-cool-full-canopy" : foliage ? "jabami-reference-leaves" : "jabami-reference-bark";
        }
        // cut out leaf cards instead of sorting transparent layers across every tree
        if (source.transparent) material.alphaTest = coolCanopy ? .16 : .25;
        if (coolCanopy) node.frustumCulled = false;
        if (ghost) material.color.set("#d2c3eb");
        else if (night) material.color.multiply(new THREE.Color("#b8c6e5"));
        material.transparent = ghost;
        material.opacity = ghost ? .24 : 1;
        material.depthWrite = !ghost;
        return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    });
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const height = bush ? .8 : survivor ? 4 : 3.7;
    const factor = height / Math.max(.001, box.max.y - box.min.y);
    scene.position.set(-center.x * factor, -box.min.y * factor, -center.z * factor);
    scene.scale.setScalar(factor);
    return scene;
  }, [gltf, ghost, night, survivor, bush, seed, autumn]);
  useEffect(() => () => {
    model.traverse((node) => {
      if (node.isMesh) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }, [model]);
  useFrame(({ clock }) => {
    if (ghost) model.traverse(node => {
      if (!node.isMesh) return;
      const opacity = guideActive ? .24 * (1 - (guidancePulse?.current ?? 0) * .85) : .24;
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => { material.opacity = opacity; });
    });
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * .5 + seed) * .007;
  });
  return (
    <group position={position} scale={scale} rotation={[0, seed * 2.4, 0]}>
      <group ref={group}><primitive object={model} /></group>
    </group>
  );
}
