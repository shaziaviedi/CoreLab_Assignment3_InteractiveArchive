import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Uniform, Vector3 } from "three";

// Keep each model's existing shader, then add view-dependent glints to lit surfaces.
export default function DreamySurfaceLight({ celestial, lightPosition }) {
  const {scene}=useThree();
  const scanTime=useRef(.5);
  const materials=useMemo(()=>new Map(),[]);
  const uniforms=useMemo(()=>({
    dreamStrength:new Uniform(0),dreamTint:new Uniform(new Color("#fff0cf")),
    dreamDirection:new Uniform(new Vector3()),
  }),[]);
  const colors=useMemo(()=>[new Color("#fff0cf"),new Color("#c0d8ff")],[]);
  useFrame((_,dt)=>{
    const state=celestial.current;
    const altitude=Math.max(state.sun,state.moon);
    const moon=state.moon>state.sun;
    uniforms.dreamStrength.value=state.to==="none" ? .06 : Math.max(0,(altitude-.2)/.8)*(moon ? .32 : .38);
    uniforms.dreamTint.value.copy(colors[moon ? 1 : 0]);
    uniforms.dreamDirection.value.copy(lightPosition);
    uniforms.dreamDirection.value.y-=45*(1-altitude);
    uniforms.dreamDirection.value.normalize();
    scanTime.current+=dt;
    if(scanTime.current<.5)return;
    scanTime.current=0;
    scene.traverse(node=>{
      if(!node.isMesh)return;
      for(const material of Array.isArray(node.material) ? node.material : [node.material]){
        if(!material?.isMeshStandardMaterial || materials.has(material))continue;
        const before=material.onBeforeCompile,key=material.customProgramCacheKey;
        const programKey=key.call(material);
        materials.set(material,{before,key});
        material.onBeforeCompile=function(shader,renderer){
          before.call(this,shader,renderer);
          Object.assign(shader.uniforms,uniforms);
          shader.fragmentShader="uniform float dreamStrength; uniform vec3 dreamTint; uniform vec3 dreamDirection;\n"+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
            vec3 dreamView=normalize(vViewPosition);
            vec3 dreamLight=normalize((viewMatrix*vec4(dreamDirection,0.)).xyz);
            vec3 dreamHalf=normalize(dreamView+dreamLight);
            float dreamRim=pow(1.-max(0.,dot(normal,dreamView)),3.);
            float dreamGlint=pow(max(0.,dot(normal,dreamHalf)),mix(48.,18.,roughnessFactor));
            float dreamLit=smoothstep(.005,.12,dot(reflectedLight.directDiffuse,vec3(.2126,.7152,.0722)));
            reflectedLight.directSpecular*=1.+dreamStrength*1.8;
            reflectedLight.directSpecular+=dreamTint*(dreamGlint*.65+dreamRim*.16)*dreamStrength*dreamLit;`);
        };
        material.customProgramCacheKey=()=>programKey+"|dream-surface-light-v1";
        material.needsUpdate=true;
      }
    });
  });
  useEffect(()=>()=>{
    for(const [material,{before,key}] of materials){
      material.onBeforeCompile=before;material.customProgramCacheKey=key;material.needsUpdate=true;
    }
    materials.clear();
  },[materials]);
  return null;
}
