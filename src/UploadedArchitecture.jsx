import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { SKYLINE_COUNT, skylinePosition } from "./SkylineLayout.js";

// use each coplanar facade's own bounds, rather than the tower's overall height
function facadeGeometry(source) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const positions = geometry.getAttribute("position");
  const faces = new Map();
  const triangles = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), edge = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions,i); b.fromBufferAttribute(positions,i+1); c.fromBufferAttribute(positions,i+2);
    normal.crossVectors(edge.subVectors(b,a),c.clone().sub(a)).normalize();
    const key=[normal.x,normal.y,normal.z].map(v=>Math.round(v*1000)).join(",")+","+Math.round(normal.dot(a)*100);
    if (!faces.has(key)) faces.set(key,{min:Infinity,max:-Infinity,reverse:normal.y<-.01});
    const face=faces.get(key);
    for (const point of [a,b,c]) { face.min=Math.min(face.min,point.y);face.max=Math.max(face.max,point.y); }
    triangles.push(face);
  }
  const values=new Float32Array(positions.count);
  for (let i=0;i<positions.count;i++) {
    const face=triangles[Math.floor(i/3)];
    const t=(positions.getY(i)-face.min)/Math.max(.001,face.max-face.min);
    values[i]=face.reverse ? 1-t : t;
  }
  geometry.setAttribute("facadeBlend",new THREE.BufferAttribute(values,1));
  return geometry;
}

function disposeMaterials(scene) {
  scene.traverse(node => {
    if (node.isMesh) {
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose());
      if (node.userData.ownFacadeGeometry) node.geometry.dispose();
    }
  });
}

export function UploadedOculus({ position, night }) {
  const gltf=useLoader(GLTFLoader,import.meta.env.BASE_URL+"models/oculus.glb");
  const model=useMemo(()=>{
    const scene=gltf.scene.clone(true);
    scene.traverse(node=>{
      if(!node.isMesh) return;
      node.castShadow=node.receiveShadow=true;
      const copy=source=>{
        const m=source.clone();
        const glass=/glass|translucent/i.test(source.name);
        m.map=null;
        m.vertexColors=false;
        m.color.set(glass ? (night ? "#5c89a7" : "#9acdd9") : "#ecedf5");
        m.metalness=glass ? .25 : .12;
        m.roughness=glass ? .2 : .62;
        m.transparent=glass;m.opacity=glass ? .8 : 1;m.depthWrite=!glass;
        return m;
      };
      node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);
    });
    const box=new THREE.Box3().setFromObject(scene),size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    const factor=14/Math.max(size.x,size.z);
    scene.scale.setScalar(factor);
    scene.position.set(-center.x*factor,-box.min.y*factor,-center.z*factor);
    return scene;
  },[gltf,night]);
  useEffect(()=>()=>disposeMaterials(model),[model]);
  return <group position={position}><primitive object={model} /></group>;
}

export function UploadedSkyline({ night }) {
  const files=useLoader(GLTFLoader,["city-lowpoly","city-newyork","one-world-trade-center"].map(name=>import.meta.env.BASE_URL+"models/"+name+".glb"));
  const skyline=useMemo(()=>{
    const root=new THREE.Group();
    const isOneWTC = (building) => {
      let found = false;
      building.traverse(node => {
        if (!node.isMesh) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        if (materials.some(material => /tower_one/i.test(material.name))) found = true;
      });
      return found;
    };
    const allLibraries=files.slice(0,2).map(file=>file.scene.children.filter(node=>node.name.startsWith("building-")));
    const oneWTC=files[2].scene;
    const libraries=allLibraries.map(library=>library.filter(building=>!isOneWTC(building)));
    const count=SKYLINE_COUNT;
    for(let i=0;i<count+(oneWTC ? 1 : 0);i++) {
      const landmark=i===count;
      const library=libraries[i%2];
      const scene=(landmark ? oneWTC : library[Math.floor(i/2)%library.length]).clone(true);
      scene.traverse(node=>{
        if(!node.isMesh)return;
        if (landmark) {
          node.geometry=facadeGeometry(node.geometry);
          node.userData.ownFacadeGeometry=true;
        }
        node.castShadow=node.receiveShadow=true;
        const copy=source=>{
          const material=source.clone();
          material.color.set("#ffffff");
          material.vertexColors=false;
          const neutralTrim=landmark && Math.max(source.color.r,source.color.g,source.color.b)-Math.min(source.color.r,source.color.g,source.color.b)<.04;
          if (neutralTrim) {
            material.map=null;
            material.color.set(night ? "#091327" : "#142746");
            material.metalness=.18;
            material.roughness=.5;
            return material;
          }
          material.metalness=landmark ? .16 : .12;material.roughness=landmark ? .18 : .75;
          material.onBeforeCompile=shader=>{
            if (landmark) {
              shader.uniforms.glassHighlight={value:new THREE.Color(night ? "#a5dce0" : "#dcf5ed")};
              shader.vertexShader="attribute float facadeBlend; varying float glassFacet; varying vec3 glassWorld; varying vec3 glassNormal;\n"+shader.vertexShader;
              shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",
                "#include <begin_vertex>\nglassFacet=facadeBlend;glassWorld=(modelMatrix*vec4(position,1.)).xyz;glassNormal=normalize(mat3(modelMatrix)*normal);");
              shader.fragmentShader="varying float glassFacet; varying vec3 glassWorld; varying vec3 glassNormal; uniform vec3 glassHighlight;\n"+shader.fragmentShader;
            }
            shader.uniforms.citySourceValue={value:landmark ? Math.sqrt(source.color.r*.2126+source.color.g*.7152+source.color.b*.0722) : 1};
            shader.uniforms.cityDark={value:new THREE.Color(landmark ? (night ? "#133b4c" : "#20566a") : night ? "#343b66" : ["#7688af","#8988b3","#7e98b4"][i%3])};
            shader.uniforms.cityLight={value:new THREE.Color(landmark ? (night ? "#4c9da9" : "#7ac6cf") : night ? "#7b83b4" : "#c7c8e0")};
            shader.fragmentShader="uniform vec3 cityDark; uniform vec3 cityLight; uniform float citySourceValue;\n"+shader.fragmentShader;
            // retain the uploaded windows + facade detail without their clashing colours
            shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
              float facadeValue=clamp(pow(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),.6)*citySourceValue,0.,1.);
              ${landmark ? "float facetGradient=smoothstep(0.,1.,glassFacet); float glassTone=mix(.12,.92,facetGradient)*mix(.65,1.,facadeValue); diffuseColor.rgb=mix(cityDark,cityLight,glassTone);" : "diffuseColor.rgb=mix(cityDark,cityLight,facadeValue);"}`);
            if (landmark) {
              shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
                `#include <color_fragment>
                float rimLight=pow(1.-abs(dot(normalize(cameraPosition-glassWorld),normalize(glassNormal))),2.);
                float shineBand=exp(-pow((glassWorld.y-(glassWorld.x+13.)*.7-16.)/1.8,2.));
                float glassShine=clamp(rimLight*.3+shineBand*.45,0.,.7);`);
              shader.fragmentShader=shader.fragmentShader.replace("#include <emissivemap_fragment>",
                "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=cityDark*.12+glassHighlight*glassShine*.55;");
            }
          };
          material.customProgramCacheKey=()=>landmark ? "one-wtc-facet-gradients" : "unified-city-facade";
          return material;
        };
        node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);
      });
      const box=new THREE.Box3().setFromObject(scene),size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const random=Math.sin(i*127.1)*43758.5;
      const height=11+(random-Math.floor(random))*7;
      const factor=landmark ? 28/size.y : Math.min(5.4/Math.max(size.x,size.z),height/size.y);
      scene.scale.setScalar(factor);
      scene.position.set(-center.x*factor,-box.min.y*factor,-center.z*factor);
      const {angle,position}=skylinePosition(Math.min(i,count-1));
      const group=new THREE.Group();
      if (landmark) {
        // northwest of the North Pool, as in the supplied map
        group.name="One World Trade Center";
        group.position.set(-13,0,-25);
        group.rotation.y=Math.PI/2;
      } else {
        group.position.set(...position);
        group.rotation.y=-angle;
      }
      group.add(scene);root.add(group);
    }
    return root;
  },[files,night]);
  useEffect(()=>()=>disposeMaterials(skyline),[skyline]);
  return <primitive object={skyline} />;
}
