import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

export default function AnimatedVisitor({ female, moving, locomotion, simTime, seed }) {
  const gender=female ? "female" : "male";
  const [idle,walk]=useLoader(GLTFLoader,["idle","walk"].map(action=>import.meta.env.BASE_URL+"models/"+gender+"-"+action+".glb"));
  const previousTime=useRef(simTime.current);
  const active=useRef(null);
  const actor=useMemo(()=>{
    const scene=clone(idle.scene);
    scene.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=true;
      node.frustumCulled=false;
      const copy = source => {
        const material = source.clone();
        const palette = ["#d9cce5", "#bfd7df", "#e5cbd0", "#cbdacb", "#e3d8c7"];
        material.roughness = .85;
        material.metalness = 0;
        material.onBeforeCompile = shader => {
          shader.uniforms.visitorTint = {value: new THREE.Color(palette[seed % palette.length])};
          shader.fragmentShader = "uniform vec3 visitorTint;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
            `#include <color_fragment>
            float clothingValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            vec3 softened=mix(vec3(clothingValue),diffuseColor.rgb,.65);
            diffuseColor.rgb=mix(softened,visitorTint,.24);`);
        };
        material.customProgramCacheKey=()=>"pastel-visitor";
        return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    });
    const mixer=new THREE.AnimationMixer(scene);
    const makeAction=(clip,name)=>{
      const copy=clip.clone();copy.name=name;
      return mixer.clipAction(copy);
    };
    const idleAction=makeAction(idle.animations[0],"idle");
    const walkAction=makeAction(walk.animations[0],"walk");
    idleAction.play();idleAction.time=(seed*.137%1)*idleAction.getClip().duration;
    mixer.update(0);
    scene.updateMatrixWorld(true);
    scene.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.update();});
    const box=new THREE.Box3().setFromObject(scene,true);
    const size=box.getSize(new THREE.Vector3());
    // normalize the posed character, not the unposed skin's export bounds
    const factor=.85/Math.max(.001,size.y);
    const center=box.getCenter(new THREE.Vector3());
    const root=new THREE.Group();
    root.scale.setScalar(factor);
    root.position.set(-center.x*factor,-box.min.y*factor,-center.z*factor);
    root.add(scene);
    const soleVertices=[];
    const vertex=new THREE.Vector3();
    scene.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const indices=[];
      for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);
        let footWeighted=false;
        if(mesh.isSkinnedMesh){
          const joints=mesh.geometry.attributes.skinIndex, weights=mesh.geometry.attributes.skinWeight;
          for(let k=0;k<4;k++){
            const bone=mesh.skeleton.bones[joints.getComponent(i,k)];
            if(weights.getComponent(i,k)>.01 && /foot|toe/i.test(bone?.name ?? "")) footWeighted=true;
          }
        }
        if(footWeighted || vertex.y < box.min.y + size.y*.12) indices.push(i);
      }
      if(indices.length) soleVertices.push({mesh,indices});
    });
    const hips=scene.getObjectByName("bip_01");
    return {root,mixer,idleAction,walkAction,scene,soleVertices,hips,factor,
      vertex:new THREE.Vector3(),hipPoint:new THREE.Vector3(),ground:new THREE.Vector3()};
  },[idle,walk,seed]);
  useEffect(()=>{
    active.current=actor.idleAction;
    previousTime.current=simTime.current;
    return ()=>{
      actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.scene);
      actor.scene.traverse(node => {
        if(node.isMesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material=>material.dispose());
      });
    };
  },[actor,simTime]);
  useFrame(()=>{
    const next=moving.current ? actor.walkAction : actor.idleAction;
    if(active.current!==next){
      next.reset().play();
      if(active.current) next.crossFadeFrom(active.current,.3,false);
      active.current=next;
    }
    const delta=Math.max(0,Math.min(.1,simTime.current-previousTime.current));
    previousTime.current=simTime.current;
    actor.walkAction.timeScale = locomotion?.current ?? 1;
    actor.mixer.update(delta);
    actor.root.updateWorldMatrix(true,true);
    actor.root.updateMatrixWorld(true);
    // Routes own horizontal travel; cancel exported root motion in the clips.
    if(actor.hips){
      actor.hips.getWorldPosition(actor.hipPoint);
      actor.root.worldToLocal(actor.hipPoint);
      actor.root.position.x=-actor.hipPoint.x*actor.factor;
      actor.root.position.z=-actor.hipPoint.z*actor.factor;
      actor.root.updateWorldMatrix(true,true);
      actor.root.updateMatrixWorld(true);
    }
    let soleY=Infinity;
    for(const {mesh,indices} of actor.soleVertices){
      if(mesh.isSkinnedMesh)mesh.skeleton.update();
      for(const index of indices){
        mesh.getVertexPosition(index,actor.vertex).applyMatrix4(mesh.matrixWorld);
        soleY=Math.min(soleY,actor.vertex.y);
      }
    }
    actor.root.parent.getWorldPosition(actor.ground);
    if(Number.isFinite(soleY)) actor.root.position.y+=actor.ground.y-soleY;
    actor.root.updateMatrixWorld(true);
    for(const {mesh} of actor.soleVertices) if(mesh.isSkinnedMesh) mesh.skeleton.update();
  });
  return <primitive object={actor.root} />;
}
