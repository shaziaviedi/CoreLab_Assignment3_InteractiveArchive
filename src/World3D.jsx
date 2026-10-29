import React, { Suspense, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import AtmosphericHaze, { skyColors, useSkyHorizon } from "./AtmosphericHaze.jsx";
import AnimatedVisitor from "./AnimatedVisitor.jsx";
import DreamySurfaceLight from "./DreamySurfaceLight.jsx";
import { EnchantedAtmosphere, EnchantedDust } from "./EnchantedEnvironment.jsx";
import { pedestrianRoute, stoppedPositions } from "./PedestrianPaths.js";
import ParkLawns from "./ParkLawns.jsx";
import { UploadedOculus, UploadedSkyline } from "./UploadedArchitecture.jsx";
import { PastelSun, MoonGlow, moonVertex, moonFragment } from "./CelestialModels.jsx";
import ReferencePool from "./ReferencePool.jsx";
import ReferenceMuseum from "./ReferenceMuseum.jsx";
import TexturedTree from "./TexturedTree.jsx";
import { OBS } from "./data.js";

const PI = Math.PI,
  TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (x) => {
  let v = Math.sin(x * 127.1 + 14.4) * 43758.5453;
  return v - Math.floor(v);
};

// map layout: north is -z, Greenwich is east (+x)
export const OVERVIEW = { pos: [-11.5, 37, 55], target: [2, 8, -1] };
// pool centres + pavilion transform measured from memorial-park-ref.glb
const NORTH_POOL = [-6.42, 0.03, -9.93];
const SOUTH_POOL = [6.41, 0.03, 9.92];
const SURVIVOR_TREE = [-3, 0, 9.92];
const STREET_X = 16.5;
const CROSSWALK_Z = 1;
const OCULUS = [27.6, 0.05, -8];
const SKY_NDC = [0.42, 0.66];
const SKY_DISTANCE = 60;
// fixed world location: camera movement must not drag the celestial bodies along
const CELESTIAL_TOP = (() => {
  const camera=new THREE.PerspectiveCamera(42,1.8,.1,280);
  camera.position.set(...OVERVIEW.pos);camera.lookAt(...OVERVIEW.target);camera.updateMatrixWorld();
  return new THREE.Vector3(SKY_NDC[0],SKY_NDC[1],.5).unproject(camera)
    .sub(camera.position).normalize().multiplyScalar(SKY_DISTANCE).add(camera.position);
})();

const ANCHORS = {
  north: { at: [NORTH_POOL[0], 0.5, NORTH_POOL[2]], pin: [NORTH_POOL[0], .1, NORTH_POOL[2] + 8], card: "left" },
  tree: { at: [SURVIVOR_TREE[0], 4.4, SURVIVOR_TREE[2]], pin: [SURVIVOR_TREE[0], .1, SURVIVOR_TREE[2] + 2], card: "above" },
  street: { at: [STREET_X, 0.1, CROSSWALK_Z], pin: [STREET_X, .1, CROSSWALK_Z + 3.5], card: "right" },
};
const CAMERA_PRESETS = {
  north: { pos: [1, 2.7, -2], target: [-6.42, 0, -9.93] },
  tree: { pos: [-8.5, 2.1, 18.5], target: [-3, 1.6, 9.92] },
  street: { pos: [18, 1.75, 9], target: [16.5, .9, -6] },
};

const inBox = (x, z, c, r) => Math.abs(x - c[0]) < r && Math.abs(z - c[2]) < r;
function nearSightline(x, z, { pos, target }) {
  const dx = target[0] - pos[0],
    dz = target[2] - pos[2];
  const t = THREE.MathUtils.clamp(
    ((x - pos[0]) * dx + (z - pos[2]) * dz) / (dx * dx + dz * dz),
    0,
    1,
  );
  return Math.hypot(x - pos[0] - t * dx, z - pos[2] - t * dz) < 2.2;
}
function inClearing(x, z) {
  return x > 13 ||
    inBox(x, z, NORTH_POOL, 7.6) || inBox(x, z, SOUTH_POOL, 7.6) ||
    (x > 0 && x < 14 && z > -8 && z < 2) ||
    Math.hypot(x - SURVIVOR_TREE[0], z - SURVIVOR_TREE[2]) < 3 ||
    Object.values(CAMERA_PRESETS).some((p) => nearSightline(x, z, p));
}
const GROVE = [];
for (let row = 0; row < 9; row++)
  for (let col = 0; col < 8; col++) {
    const x = -18 + col * 3.1, z = -17 + row * 3.6;
    if (!inClearing(x, z)) GROVE.push([x, z]);
  }
// spread new trees around the park edges rather than packing the existing grove
const extraPlanting = [
  [-14, -20], [3, -20], [10.4, -15.8],
  [7.5, -13], [11.5, -9],
  [-12, 19.5], [-4, 19.5], [4, 19], [11, 19],
];
for (const [x, z] of extraPlanting) {
  if (!inClearing(x, z) && GROVE.every(([gx, gz]) => Math.hypot(gx - x, gz - z) > 4.2)) {
    GROVE.push([x, z]);
  }
}
// a continuous row anchors the northern lawn instead of one isolated tree
for (const x of [-10, -6.4, -2.8]) {
  GROVE.push([x, -18.85]);
}
// low planting stays on the lawn beds, away from the Survivor Tree's paving
const BUSHES = [
  [-10.5,-19.7], [-6.8,-19.7], [-2,-19.7],
  [-17.5,-13], [-15,-6], [-16,3], [-16,10], [-15,14.5],
  [-10,-.5], [-5.2,.8], [-9.8,5.5], [-9.5,14],
  [3.3,-14], [3.3,-9.5], [8.5,-15.8], [10.8,-12.5],
  [-1.4,1.8], [2,18.6], [5,19.3], [8.4,18.5], [11,19.4],
  [-18,-16], [-15,-15], [-18,-8], [-14.4,-3.4],
  [-17,6.5], [-14.5,8], [-17,13.5], [-15.5,16],
  [-10.8,1], [-7.5,.7], [-10,8.5], [-7.3,12.5], [-10.2,16],
  [-9,-19.7], [-4.5,-19.7], [-1.8,-18],
  [2.7,-11.7], [4.2,-15], [7.4,-10], [9.5,-9.2], [11,-16],
  [-2,2.8], [-11,19.8], [-7.5,19.8], [-3,19.7],
  [3.6,18.2], [8.2,19.7], [10.7,18.3],
];
// Match the planted positions, including their seeded offsets and model scale.
const PEDESTRIAN_OBSTACLES = [
  ...GROVE.map(([x,z],i) => ({x:x+(hash(i*5)-.5)*.5,z:z+(hash(i*7)-.5)*.5,radius:.65})),
  ...BUSHES.map(([x,z],i) => ({x,z,radius:[1.01,1.69,1.44,.98][i%4]*(.85+hash(i+27)*.3)+.3})),
  {x:SURVIVOR_TREE[0],z:SURVIVOR_TREE[2],radius:.85},
  // Uploaded Oculus is normalized to 14 x 12; include shoulder clearance.
  {box:true,x:OCULUS[0],z:OCULUS[2],hx:7.35,hz:6.35},
];
const skyVert = `varying vec2 vSkyUv;
void main(){vSkyUv=uv;gl_Position=vec4(position.xy,1.,1.);}`;
const skyFrag = `precision highp float;
varying vec2 vSkyUv;
uniform float uNight;uniform float uDay;uniform float uTime;
uniform vec2 uSkySize;
${skyColors}
float starHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cloudNoise(vec2 p){
  vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(starHash(cell),starHash(cell+vec2(1.,0.)),f.x),mix(starHash(cell+vec2(0.,1.)),starHash(cell+1.),f.x),f.y);
}
float cloudLayers(vec2 p){
  float value=0.,weight=.5;
  for(int i=0;i<5;i++){
    value+=cloudNoise(p)*weight;
    p=p*2.03+vec2(7.1,13.7);weight*=.5;
  }
  return value;
}
void main(){
  vec3 color=skyColor(vSkyUv,uDay,uNight);
  vec2 grid=vSkyUv*uSkySize/48.;
  vec2 cell=floor(grid);
  float seed=starHash(cell);
  vec2 center=vec2(.2)+vec2(starHash(cell+17.),starHash(cell+41.))*.6;
  vec2 p=(fract(grid)-center)*48.;
  float twinkle=.55+.45*sin(uTime*(.65+seed)+seed*63.);
  float core=exp(-dot(p,p)/(seed>.96 ? 2.2 : .65));
  float glow=exp(-dot(p,p)/18.)*.12;
  float cross=exp(-abs(p.x)*4.-abs(p.y)*.3)+exp(-abs(p.y)*4.-abs(p.x)*.3);
  float skyOnly=smoothstep(skyEdge(vSkyUv.x)+.015,skyEdge(vSkyUv.x)+.05,vSkyUv.y);
  float stars=step(.86,seed)*(core*.35+glow+cross*.5)*twinkle*uNight*skyOnly;
  color+=mix(vec3(.65,.76,1.),vec3(1.,.92,.74),seed)*stars*.7;
  // Soft cloud banks drift behind the skyline, leaving gaps for the blue gradient.
  vec2 cloudUv=vec2(vSkyUv.x*uSkySize.x/max(1.,uSkySize.y)*3.,vSkyUv.y*7.);
  cloudUv+=vec2(uTime*.009,uTime*.0015);
  float cloudField=cloudLayers(cloudUv+vec2(cloudNoise(cloudUv*.6)*.7,0.));
  float cloud=smoothstep(.46,.69,cloudField);
  float cloudMask=smoothstep(skyEdge(vSkyUv.x)+.035,skyEdge(vSkyUv.x)+.14,vSkyUv.y);
  vec3 cloudColor=mix(linearRGB(vec3(.88,.86,.96)),linearRGB(vec3(1.,.97,.94)),smoothstep(.48,.72,cloudField));
  color=mix(color,cloudColor,cloud*cloudMask*uDay*(1.-uNight)*.5);
  float nightCloud=smoothstep(.60,.78,cloudField);
  vec3 nightCloudColor=mix(linearRGB(vec3(.32,.34,.53)),linearRGB(vec3(.48,.48,.68)),cloudField);
  color=mix(color,nightCloudColor,nightCloud*cloudMask*uNight*.3);
  gl_FragColor=vec4(color,1.);
}`;
const waterVert = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const waterFrag = `precision highp float; varying vec2 vUv;uniform float uTime;uniform float uNight;uniform float uDay;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float n2(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 uv=vUv;float ripple=sin((uv.x+uv.y)*35.-uTime*.93)*.017+sin(uv.x*95.+uTime*.43)*.009;
float waves=n2(uv*22.+uTime*.07);vec3 dark=mix(vec3(.020,.075,.12),vec3(.015,.047,.08),uNight);
dark=mix(dark,vec3(.035,.16,.22),uDay);
float brightness=clamp(waves*.10+ripple+.022,0.,1.);vec3 color=dark+vec3(.27,.45,.54)*brightness;
float foam=max(smoothstep(.95,1.,uv.x),smoothstep(.95,1.,uv.y))*0.18;
color+=vec3(.33,.55,.67)*foam;gl_FragColor=vec4(color,1.);}`;
const fallVert = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fallFrag = `precision mediump float;varying vec2 vUv;uniform float uTime;uniform float uNight;
float hash(float x){return fract(sin(x*43.758)*13842.23);}
void main(){float streak=sin(vUv.x*530.+sin(uTime*1.8+vUv.x*60.)*1.5)*.5+.5;
float foam=sin(vUv.y*90.-uTime*13.+hash(floor(vUv.x*65.))*6.28)*.5+.5;
float a=.2+.35*pow(streak,5.)+.13*foam;
vec3 c=mix(vec3(.56,.82,.94),vec3(.58,.67,.95),uNight);gl_FragColor=vec4(c,a);}`;

function Sky({ blend, daylight, paused, reducedMotion }) {
  const horizon = useSkyHorizon();
  const ref = useRef();
  const uniforms = useMemo(
    () => ({ skyHorizon: { value: horizon }, uNight: { value: 0 }, uDay: { value: 0 }, uTime: { value: 0 }, uSkySize: { value: new THREE.Vector2(1, 1) } }),
    [horizon],
  );
  useFrame(({ size },dt) => {
    if (ref.current) {
      ref.current.uniforms.uSkySize.value.set(size.width, size.height);
      ref.current.uniforms.uNight.value = blend.current;
      ref.current.uniforms.uDay.value = daylight.current;
      if(!paused && !reducedMotion) ref.current.uniforms.uTime.value += Math.min(dt,.05);
    }
  });
  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={ref}
        depthTest={false}
        depthWrite={false}
        blending={THREE.NoBlending}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={skyVert}
        fragmentShader={skyFrag}
      />
    </mesh>
  );
}
function SunMoon({ placed, night, blend, guideActive, guidancePulse, celestial }) {
  let sun = useRef(),
    moon = useRef();
  const { camera } = useThree();
  useFrame(() => {
    const state=celestial.current;
    sun.current.position.copy(CELESTIAL_TOP);
    sun.current.position.y -= 45 * (1-state.sun);
    sun.current.visible=!placed || state.sun>.005;
    sun.current.quaternion.copy(camera.quaternion);
    moon.current.position.copy(CELESTIAL_TOP);
    moon.current.position.y -= 45 * (1-state.moon);
    moon.current.quaternion.copy(camera.quaternion);
    moon.current.visible=placed && state.moon>.005;
    const fade = guideActive ? 1 - guidancePulse.current * .85 : 1;
    sun.current.traverse(node => {
      if (node.isMesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => {
        const opacity = (placed ? 1 : .24) * fade;
        if (material.uniforms?.sunOpacity) material.uniforms.sunOpacity.value = opacity;
        else material.opacity = opacity;
      });
    });
    moon.current.traverse(node => {
      if(node.isMesh && node.material.uniforms?.moonOpacity) node.material.uniforms.moonOpacity.value=fade;
    });
  });
  return (
    <group>
      <group ref={sun}>
        {placed ? <PastelSun placed /> : (
          <mesh>
            <sphereGeometry args={[2.3, 48, 32]} />
            <meshBasicMaterial color="#c7c0d3" transparent opacity={.24} depthWrite={false} toneMapped={false} side={THREE.FrontSide} />
          </mesh>
        )}
      </group>
      <group ref={moon}>
        <MoonGlow />
        <mesh>
        <sphereGeometry args={[1.7, 48, 32]} />
        <shaderMaterial vertexShader={moonVertex} fragmentShader={moonFragment}
          uniforms={{moonOpacity: {value: 1}}} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
function Ground({ sunny, streetPlaced, guideActive, guidancePulse }) {
  const crosswalkMaterials = useRef([]);
  const streetMaterial = useRef(null);
  const laneMaterials = useRef({});
  useFrame(() => {
    const fade = guideActive ? 1 - guidancePulse.current * .85 : 1;
    if (streetMaterial.current) streetMaterial.current.opacity = streetPlaced ? 1 : .32 * fade;
    Object.values(laneMaterials.current).forEach(material => {
      if (material) material.opacity = streetPlaced ? .4 : .32 * fade;
    });
    crosswalkMaterials.current.forEach(material => {
      if (material) material.opacity = streetPlaced ? .85 : guideActive ? .32 * (1 - guidancePulse.current * .85) : .32;
    });
  });
  const streets = useMemo(() => [STREET_X, -25].map((center) => {
    const halfWidth = center === STREET_X ? 3 : 2.5;
    const shape = new THREE.Shape();
    shape.moveTo(center - halfWidth, -85);
    shape.lineTo(center + halfWidth, -85);
    // follow the curved city edge so the roads don't stop halfway across the plaza
    for (let i = 0; i <= 20; i++) {
      const x = center + halfWidth - i / 20 * halfWidth * 2;
      shape.lineTo(x, 2 + Math.sqrt(48 * 48 - x * x));
    }
    shape.closePath();
    return shape;
  }), []);
  const plaza = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-65, -85);
    shape.lineTo(65, -85);
    shape.lineTo(48, 2);
    shape.absarc(0, 2, 48, 0, Math.PI, false);
    shape.closePath();
    // openings let the imported basins sit below the paving instead of getting covered
    for (const [x, , z] of [NORTH_POOL, SOUTH_POOL]) {
      const hole = new THREE.Path();
      const edge = [
        [-5.5, -5.04], [-5.19, -5.35], [5.19, -5.35], [5.5, -5.04],
        [5.5, 5.04], [5.19, 5.35], [-5.19, 5.35], [-5.5, 5.04],
      ];
      edge.forEach(([dx, dz], i) => {
        if (i === 0) hole.moveTo(x + dx, -z + dz);
        else hole.lineTo(x + dx, -z + dz);
      });
      hole.closePath();
      shape.holes.push(hole);
    }
    return shape;
  }, []);
  const tex = useMemo(() => {
    let canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    let c = canvas.getContext("2d");
    c.fillStyle = "#c2b5bd";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 27000; i++) {
      const x = hash(i * 3 + 1) * 512,
        y = hash(i * 3 + 2) * 512;
      c.fillStyle = `rgba(${i % 2 === 0 ? "248,242,244" : "80,66,92"},${0.01 + hash(i + 7) * 0.07})`;
      c.fillRect(x, y, hash(i * 4) * 3 + 0.5, hash(i * 2) * 3 + 0.5);
    }
    for (let i = 0; i < 33; i++) {
      let x = i * 16;
      c.strokeStyle = "rgba(53,48,76,.09)";
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 512);
      c.stroke();
      c.beginPath();
      c.moveTo(0, x);
      c.lineTo(512, x);
      c.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(.45, .45);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      <mesh rotation={[-PI / 2, 0, 0]} receiveShadow>
        {/* finite plaza so the ground doesn’t cover the sky */}
        <shapeGeometry args={[plaza, 64]} />
        <meshStandardMaterial map={tex} color={sunny ? "#f2e5ef" : "#f4ebf7"} roughness={0.98} />
      </mesh>
      <ParkLawns sunny={sunny} />
      {streets.map((shape, i) => (
        <mesh key={i} rotation={[-PI / 2, 0, 0]} position={[0, .035, 0]} receiveShadow>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial ref={i === 0 ? streetMaterial : undefined}
            color={sunny ? "#9baab7" : "#899eaf"} roughness={.96}
            transparent={i === 0} opacity={i === 0 && !streetPlaced ? .32 : 1}
            depthWrite={i !== 0 || streetPlaced} />
        </mesh>
      ))}
      <mesh rotation={[-PI / 2, 0, 0]} position={[0, .04, 23]} receiveShadow>
        <planeGeometry args={[80, 5]} />
        <meshStandardMaterial color={sunny ? "#9baab7" : "#899eaf"} roughness={.96} />
      </mesh>
      {Array.from({length: 13}, (_, i) => -36 + i * 6)
        .filter(x => Math.abs(x - STREET_X) > 4 && Math.abs(x + 25) > 3.5)
        .map(x => <mesh key={x} rotation={[-PI / 2, 0, 0]} position={[x, .05, 23]}>
          <planeGeometry args={[2.1, .09]} />
          <meshBasicMaterial color="#efedf2" transparent opacity={.4} />
        </mesh>)}
      {Array.from({ length: 22 }, (_, i) => -40 + i * 6)
        .filter((z) => Math.abs(z - CROSSWALK_Z) > 2.5 && Math.abs(z - 23) > 3)
        .map((z) => (
          <mesh
            key={z}
            rotation={[-PI / 2, 0, 0]}
            position={[STREET_X, 0.05, z]}
          >
            <planeGeometry args={[0.09, 2.1]} />
            <meshBasicMaterial ref={material => { laneMaterials.current[z] = material; }} color="#efedf2" transparent opacity={streetPlaced ? .4 : .32} depthWrite={false} />
          </mesh>
        ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={"zebra" + i}
          rotation={[-PI / 2, 0, 0]}
          position={[STREET_X - 2.45 + i * 0.7, 0.055, CROSSWALK_Z]}
          receiveShadow
        >
          <planeGeometry args={[0.36, 2.2]} />
          <meshStandardMaterial
            ref={material => { crosswalkMaterials.current[i] = material; }}
            color={streetPlaced ? "#eeeaf2" : "#898995"}
            transparent
            opacity={streetPlaced ? .85 : .32}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
function Pool(props) {
  return (
    <Suspense fallback={<PlaceholderPool {...props} />}>
      <ReferencePool at={props.at} active={props.active} night={props.night} celestial={props.celestial} lightPosition={CELESTIAL_TOP} blend={props.blend} guideActive={props.guideActive} guidancePulse={props.guidancePulse} />
    </Suspense>
  );
}

function PlaceholderPool({ at, active, blend, index, sunny }) {
  let water = useRef(),
    waterU = useMemo(() => ({ uTime: { value: 0 }, uNight: { value: 0 }, uDay: { value: 0 } }), []);
  let fallU = useMemo(
    () => ({ uTime: { value: 0 }, uNight: { value: 0 } }),
    [],
  );
  useFrame(({ clock }) => {
    waterU.uDay.value = lerp(waterU.uDay.value, sunny ? 1 : 0, 0.025);
    waterU.uTime.value = clock.elapsedTime;
    waterU.uNight.value = blend.current;
    fallU.uTime.value = clock.elapsedTime;
    fallU.uNight.value = blend.current;
  });
  const rail = 11.2,
    inner = 10.1;
  return (
    <group position={at}>
      <mesh castShadow receiveShadow position={[0, 0.14, 0]}>
        <boxGeometry args={[rail, 0.31, rail]} />
        <meshStandardMaterial
          color={sunny ? "#151e32" : "#242834"}
          roughness={0.45}
          metalness={0.45}
        />
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[inner, inner]} />
        <shaderMaterial
          ref={water}
          uniforms={waterU}
          vertexShader={waterVert}
          fragmentShader={waterFrag}
        />
      </mesh>
      <mesh position={[0, 0.315, 0]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[3.3, 3.3]} />
        <meshBasicMaterial color="#040912" toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        let along = i < 2;
        let p = along
          ? [0, 0.42, (i === 0 ? -1 : 1) * (rail / 2)]
          : [(i === 2 ? -1 : 1) * (rail / 2), 0.42, 0];
        return (
          <mesh key={"rail" + i} position={p} castShadow>
            <boxGeometry
              args={
                along ? [rail + 0.14, 0.23, 0.24] : [0.24, 0.23, rail + 0.14]
              }
            />
            <meshStandardMaterial
              color={sunny ? "#9a88ad" : "#4a4850"}
              metalness={0.6}
              roughness={0.25}
            />
          </mesh>
        );
      })}
      {[0, 1, 2, 3].map((i) => {
        let p =
          i < 2
            ? [0, -0.1, i === 0 ? -inner / 2 : inner / 2]
            : [i === 2 ? -inner / 2 : inner / 2, -0.1, 0];
        return (
          <mesh
            key={"fall" + i}
            position={p}
            rotation={i < 2 ? [0, 0, 0] : [0, PI / 2, 0]}
          >
            <planeGeometry args={[inner, 0.95]} />
            <shaderMaterial
              uniforms={fallU}
              vertexShader={fallVert}
              fragmentShader={fallFrag}
              transparent
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      {!active && (
        <mesh rotation={[-PI / 2, 0, 0]} position={[0, 0.34, 0]}>
          <ringGeometry args={[0.86, 0.9, 64]} />
          <meshBasicMaterial
            color="#e9e6fa"
            transparent
            opacity={0.68}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
function PlaceholderTree({
  position,
  scale = 1,
  seed = 12,
  ghost = false,
  night = false,
  sunny = false,
}) {
  const props = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        let a = hash(seed + i * 17) * TAU,
          dist = Math.sqrt(hash(seed + i * 21));
        return [
          Math.cos(a) * dist * 0.83,
          hash(seed + i * 27) * 0.7,
          Math.sin(a) * dist * 0.83,
          0.36 + hash(seed + i * 31) * 0.27,
          hash(seed + i * 61),
        ];
      }),
    [seed],
  );
  let group = useRef();
  useFrame(({ clock }) => {
    if (group.current)
      group.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.35 + seed) * 0.012;
  });
  return (
    <group position={position} scale={scale} ref={group}>
      <mesh castShadow position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.14, 0.22, 1.75, 9]} />
        <meshStandardMaterial
          color={ghost ? "#b7a4cf" : sunny ? "#705461" : "#706071"}
          transparent={ghost}
          opacity={ghost ? 0.27 : 1}
          roughness={1}
        />
      </mesh>
      {[
        [-0.48, 1.7, -0.1],
        [0.45, 1.5, 0.16],
        [0.08, 1.92, -0.3],
      ].map((p, i) => (
        <mesh
          key={i}
          position={p}
          rotation={[(i % 2) * 0.4, 0, (i - 1) * 0.6]}
          castShadow
        >
          <cylinderGeometry args={[0.065, 0.12, 1.2, 7]} />
          <meshStandardMaterial
            color={sunny ? "#795968" : "#776472"}
            transparent={ghost}
            opacity={ghost ? 0.2 : 1}
          />
        </mesh>
      ))}
      {props.map((p, i) => (
        <mesh key={i} position={[p[0], 2.42 + p[1], p[2]]} castShadow={!ghost}>
          <icosahedronGeometry args={[p[3], 2]} />
          <meshStandardMaterial
            color={
              ghost
                ? "#e2d2ff"
                : new THREE.Color().setHSL(
                    (sunny ? 0.29 : 0.34) + hash(i + seed) * (sunny ? 0.07 : 0.1),
                    (sunny ? 0.29 : 0.18) + 0.08 * hash(i),
                    night ? 0.43 : sunny ? 0.57 : 0.61,
                  )
            }
            transparent
            opacity={ghost ? 0.1 : 0.88}
            roughness={0.88}
          />
        </mesh>
      ))}
    </group>
  );
}
function Tree(props) {
  return (
    <Suspense fallback={<PlaceholderTree {...props} />}>
      <TexturedTree {...props} />
    </Suspense>
  );
}

function PlaceholderMuseum() {
  return (
    <group position={[2, 0, -.4]} rotation={[0, -.12, 0]} scale={[.85, 1, .8]}>
      <mesh position={[0, .5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.1, 1, 6]} />
        <meshStandardMaterial color="#8f929e" roughness={.7} />
      </mesh>
      <mesh position={[0, 1.45, 0]} rotation={[0, 0, -.13]} castShadow>
        <boxGeometry args={[4.4, .22, 6.4]} />
        <meshStandardMaterial color="#bcc8da" metalness={.5} roughness={.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.06, 1.02, 0]}>
          <boxGeometry args={[.06, .85, 5.8]} />
          <meshStandardMaterial color="#6395a8" metalness={.6} roughness={.2} />
        </mesh>
      ))}
      {Array.from({length: 12}, (_, i) => (
        <mesh key={i} position={[-2.1, 1, -2.7 + i * .49]}>
          <boxGeometry args={[.08, 1.1, .045]} />
          <meshStandardMaterial color="#d3d5e1" />
        </mesh>
      ))}
    </group>
  );
}

function Person({ zone, index, data, enabled, simTime, stopPosition }) {
  const ref = useRef(),
    flashRef = useRef();
  const moving=useRef(index < data.crossings);
  const locomotion=useRef(1);
  const travel=useRef(hash(index * 31 + (zone === "north" ? 1 : zone === "tree" ? 2 : 3)));
  const previousTime=useRef(simTime.current);
  // Route, direction and character choice use separate seeds.
  const direction = Math.floor(index / 2) % 2 === 0 ? 1 : -1;
  const female = hash(index * 47 + (zone === "north" ? 11 : zone === "tree" ? 23 : 37)) > .5;
  const linearPath = zone === "street" || (zone === "tree" && index % 3 === 0);
  useFrame(() => {
    if (!ref.current) return;
    let t = simTime.current;
    let speed =
      (0.65 + 0.35 * hash(index * 12)) *
      Math.max(0.65, Math.min(1.3, data.crossings / 23));
    const delta=Math.max(0,Math.min(.1,t-previousTime.current));
    previousTime.current=t;
    const stopped = enabled && index >= data.crossings;
    moving.current = !stopped;
    const routeLength = zone === "north" ? 50 : zone === "tree" ? (linearPath ? 13.5 : 14) : (index % 2 === 0 ? 21.8 : 32);
    if (!stopped) travel.current = (travel.current + delta * speed / routeLength) % 1;
    // A short offstage gap separates the exit from the next entrance on open paths.
    const inTransit = linearPath && !stopped && travel.current >= .96;
    const progress = linearPath && !stopped ? Math.min(travel.current / .96, 1) : travel.current;
    const f = direction === 1 ? progress : 1-progress;
    const [x,z] = stopped ? stopPosition : pedestrianRoute(zone,index,linearPath ? f : f % 1,PEDESTRIAN_OBSTACLES);
    const nextF = linearPath ? THREE.MathUtils.clamp(f + direction * .001, 0, 1) : (f + direction * .001 + 1) % 1;
    const [nextX,nextZ] = pedestrianRoute(zone,index,nextF,PEDESTRIAN_OBSTACLES);
    const traveled = Math.hypot(x-ref.current.position.x,z-ref.current.position.z);
    moving.current = !stopped && !inTransit && (delta === 0 || traveled > .00001);
    locomotion.current = speed / .75;
    const onRoad = zone === "street" && Math.abs(x-STREET_X)<3;
    const groundHeight = onRoad ? (Math.abs(z-CROSSWALK_Z)<1.1 ? .055 : .035) : .002;
    ref.current.position.set(x, groundHeight, z);
    const focal = zone === "north" ? NORTH_POOL : zone === "tree" ? SURVIVOR_TREE : [STREET_X,0,z];
    ref.current.rotation.y = stopped
      ? Math.atan2(focal[0]-x,focal[2]-z)
      : Math.atan2(nextX-x,nextZ-z);
    ref.current.visible = enabled && !inTransit;
    ref.current.scale.setScalar(1);
    if (flashRef.current)
      flashRef.current.visible =
        enabled &&
        stopped &&
        index - data.crossings < data.photographing &&
        Math.sin(t * 3 + index * 2.6) > 0.984;
  });
  return (
    <group ref={ref} userData={{ pedestrian: true }}>
      <Suspense fallback={null}>
        <AnimatedVisitor female={female} moving={moving} locomotion={locomotion} simTime={simTime} seed={index} />
      </Suspense>
      <mesh ref={flashRef} position={[0, 0.62, 0.2]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial color={[4, 4, 3.6]} toneMapped={false} />
      </mesh>
    </group>
  );
}
function People({ placed, period, paused }) {
  const d = OBS[period];
  const idleLayout = useMemo(() => Object.fromEntries(["north","tree","street"].map(zone =>
    [zone, stoppedPositions(zone,d[zone].stops,d[zone].crossings,PEDESTRIAN_OBSTACLES)])),[d]);
  const simTime = useRef(0);
  useFrame((_, dt) => {
    if (!paused) simTime.current += dt;
  });
  return (
    <group>
      {["north", "tree", "street"].map((zone) =>
        Array.from({ length: placed.sky && placed[zone] ? d[zone].crossings + d[zone].stops : 0 }, (_, i) => (
          <Person
            key={zone + i}
            zone={zone}
            index={i}
            stopPosition={idleLayout[zone][i-d[zone].crossings]}
            data={d[zone]}
            enabled={placed[zone]}
            simTime={simTime}
          />
        )),
      )}
    </group>
  );
}
// widen the lens on narrow screens, then back up if needed to keep the plaza in view
const BASE_FOV = 42,
  MAX_FOV = 75,
  FIT_ASPECT = 1.3;
const deg = THREE.MathUtils.degToRad;
function Rig({ cameraZone, interactive, viewReset }) {
  const { camera, gl } = useThree();
  const orbit=useRef({yaw:0,pitch:0,zoom:1,focus:new THREE.Vector3(...OVERVIEW.target)});
  const spherical=useMemo(()=>new THREE.Spherical(),[]);
  useEffect(()=>{
    Object.assign(orbit.current,{yaw:0,pitch:0,zoom:1});
    orbit.current.focus.set(...OVERVIEW.target);
  },[viewReset]);
  useEffect(()=>{
    const canvas=gl.domElement;
    if(cameraZone || !interactive)return;
    const pointers=new Map();
    const oldCursor=canvas.style.cursor,oldTouch=canvas.style.touchAction;
    canvas.style.cursor="grab";canvas.style.touchAction="none";
    const clamp=THREE.MathUtils.clamp;
    const raycaster=new THREE.Raycaster();
    const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const cursor=new THREE.Vector2();
    const groundAt=(x,y)=>{
      const rect=canvas.getBoundingClientRect();
      cursor.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
      raycaster.setFromCamera(cursor,camera);
      return raycaster.ray.intersectPlane(ground,new THREE.Vector3());
    };
    const limitFocus=()=>{
      const focus=orbit.current.focus;
      focus.x=clamp(focus.x,-48,48);focus.z=clamp(focus.z,-48,38);focus.y=clamp(focus.y,0,8);
    };
    const zoomAt=(factor,x,y)=>{
      const state=orbit.current;
      const next=clamp(state.zoom*factor,.12,1.25);
      const anchor=groundAt(x,y);
      if(anchor)state.focus.addScaledVector(anchor.sub(state.focus),1-next/state.zoom);
      state.zoom=next;limitFocus();
    };
    const pan=(from,to)=>{
      const a=groundAt(from.x,from.y),b=groundAt(to.x,to.y);
      if(a&&b){orbit.current.focus.addScaledVector(a.sub(b),.75);limitFocus();}
    };
    const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
    const midpoint=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
    const down=e=>{
      if(e.button!==0 && e.button!==2)return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey});
      canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing";
    };
    const move=e=>{
      const previous=pointers.get(e.pointerId);if(!previous)return;
      const before=pointers.size===2 ? distance() : 0;
      const oldCenter=pointers.size===2 ? midpoint() : null;
      const next={x:e.clientX,y:e.clientY,pan:previous.pan};
      pointers.set(e.pointerId,next);
      if(pointers.size===2){
        const after=distance(),center=midpoint();
        pan(oldCenter,center);
        if(before>0 && after>0)zoomAt(Math.pow(before/after,.65),center.x,center.y);
      } else if(pointers.size===1){
        if(previous.pan)pan(previous,next);
        else {
          orbit.current.yaw=clamp(orbit.current.yaw-(e.clientX-previous.x)*.0012,-.45,.45);
          orbit.current.pitch=clamp(orbit.current.pitch+(e.clientY-previous.y)*.0009,-.22,.15);
        }
      }
    };
    const up=e=>{
      pointers.delete(e.pointerId);
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor=pointers.size ? "grabbing" : "grab";
    };
    const wheel=e=>{
      e.preventDefault();
      const delta=e.deltaY*(e.deltaMode===1 ? 16 : e.deltaMode===2 ? canvas.clientHeight : 1);
      zoomAt(Math.exp(clamp(delta,-180,180)*.00055),e.clientX,e.clientY);
    };
    const context=e=>e.preventDefault();
    canvas.addEventListener("contextmenu",context);
    canvas.addEventListener("pointerdown",down);
    canvas.addEventListener("pointermove",move);
    canvas.addEventListener("pointerup",up);
    canvas.addEventListener("pointercancel",up);
    canvas.addEventListener("lostpointercapture",up);
    canvas.addEventListener("wheel",wheel,{passive:false});
    return ()=>{
      canvas.removeEventListener("contextmenu",context);
      canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);
      canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);
      canvas.removeEventListener("lostpointercapture",up);canvas.removeEventListener("wheel",wheel);
      for(const id of pointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
      canvas.style.cursor=oldCursor;canvas.style.touchAction=oldTouch;
    };
  },[gl,cameraZone,interactive,viewReset]);
  let look = useRef(new THREE.Vector3(...OVERVIEW.target));
  const goal = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const s = (cameraZone && CAMERA_PRESETS[cameraZone]) || OVERVIEW;
    const halfTan =
      Math.tan(deg(BASE_FOV / 2)) * Math.max(1, FIT_ASPECT / camera.aspect);
    const maxTan = Math.tan(deg(MAX_FOV / 2));
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.min(halfTan, maxTan)));
    const pullBack = cameraZone ? 1 : Math.max(1, halfTan / maxTan);
    aim.set(...s.target);
    goal.set(...s.pos).sub(aim).multiplyScalar(pullBack).add(aim);
    if (!cameraZone) {
      spherical.setFromVector3(goal.sub(aim));
      spherical.theta+=orbit.current.yaw;
      spherical.phi=THREE.MathUtils.clamp(spherical.phi+orbit.current.pitch,.5,1.35);
      spherical.radius*=orbit.current.zoom;
      aim.copy(orbit.current.focus);
      goal.setFromSpherical(spherical).add(aim);
    }
    const k = 1-Math.exp(-Math.min(dt,.05)*(cameraZone ? 1.2 : 1.7));
    camera.position.lerp(goal, k);
    look.current.lerp(aim, k);
    camera.lookAt(look.current);
    camera.updateProjectionMatrix();
  });
  return null;
}
const _anchor = new THREE.Vector3();
function ScreenAnchors({ overlays }) {
  const { camera, size } = useThree();
  const toScreen = (v) => [
    ((v.x + 1) / 2) * size.width,
    ((1 - v.y) / 2) * size.height,
  ];
  const place = (el, x, y) => {
    el.style.left = x + "px";
    el.style.top = y + "px";
  };
  useFrame(() => {
    const els = overlays.current;
    const floor = size.height - 24;
    const taken = [];
    const menu = document.querySelector(".scene-intro");
    if (menu) {
      const r = menu.getBoundingClientRect();
      taken.push([r.left - 12, r.top - 12, r.right + 12, r.bottom + 12]);
    }
    const cards = [];
    for (const key in els) {
      const [kind, zone] = key.split(":");
      if (kind === "stats") {
        cards.push([els[key], zone]);
        continue;
      }
      const [x, y] =
        zone === "sky"
          ? toScreen(_anchor.copy(CELESTIAL_TOP).project(camera))
          : toScreen(_anchor.set(...(kind === "pin" ? ANCHORS[zone].pin : ANCHORS[zone].at)).project(camera));
      place(els[key], x, y);
      if (kind === "pin") taken.push([x - 22, y - 22, x + 22, y + 22]);
    }
    // try the preferred side first, then look for room away from pins + other cards
    for (const [el, zone] of cards) {
      const a = ANCHORS[zone],
        w = el.offsetWidth,
        h = el.offsetHeight,
        gap = 30;
      const rectFor = (side, point) => {
        const [x, y] = toScreen(_anchor.set(...point).project(camera));
        const left =
          side === "left" ? x - gap - w : side === "right" ? x + gap : x - w / 2;
        const top =
          side === "above"
            ? y - (point === a.at ? gap : 0) - h
            : side === "below"
              ? y + gap
              : y - h / 2;
        return [left, top, left + w, top + h];
      };
      const overlap = (r) =>
        taken.reduce(
          (sum, t) =>
            sum +
            Math.max(0, Math.min(r[2], t[2]) - Math.max(r[0], t[0])) *
              Math.max(0, Math.min(r[3], t[3]) - Math.max(r[1], t[1])),
          0,
        );
      const fits = (r) =>
        r[0] >= 16 &&
        r[2] <= size.width - 16 &&
        r[1] >= 72 &&
        r[3] <= floor &&
        overlap(r) === 0;
      const options = [rectFor(a.card, a.cardAt || a.at)].concat(
        ["above", "below", "left", "right"].map((side) => rectFor(side, a.at)),
      );
      const clamped = options.map(([l, t]) => {
        const left = THREE.MathUtils.clamp(l, 16, size.width - w - 16),
          top = THREE.MathUtils.clamp(t, 72, Math.max(72, floor - h));
        return [left, top, left + w, top + h];
      });
      const r =
        options.find(fits) ||
        clamped.reduce((best, c) => (overlap(c) < overlap(best) ? c : best));
      place(el, r[0], r[1]);
      taken.push(r);
    }
  });
  return null;
}

function SceneLighting({ daylight, blend, celestial }) {
  const ambient=useRef(),sunlight=useRef(),hemisphere=useRef();
  const colors=useMemo(()=>({warm:new THREE.Color("#fff2e6"),white:new THREE.Color("#ffffff"),night:new THREE.Color("#bdc5f7"),moon:new THREE.Color("#c9cafa")}),[]);
  useFrame(()=>{
    const d=daylight.current,n=blend.current;
    ambient.current.intensity=lerp(lerp(1.65,2.1,d),.88,n);
    ambient.current.color.copy(colors.warm).lerp(colors.white,d).lerp(colors.night,n);
    const state=celestial.current;
    const active=state.to!=="none";
    const altitude=Math.max(state.sun,state.moon);
    const moonlight=state.moon>state.sun;
    if(active){
      sunlight.current.position.copy(CELESTIAL_TOP);
      sunlight.current.position.y-=45*(1-altitude);
    } else sunlight.current.position.set(-12,22,8);
    sunlight.current.intensity=active ? (moonlight ? 2 : 3.4)*THREE.MathUtils.smoothstep(altitude,.12,1) : 3;
    sunlight.current.color.copy(moonlight ? colors.moon : colors.warm).lerp(colors.white,moonlight ? 0 : d);
    hemisphere.current.intensity=lerp(.12,.85,d)*(1-n*.8);
  });
  return <>
    <ambientLight ref={ambient}/>
    <hemisphereLight ref={hemisphere} args={["#d9efff","#c9bbc9",.12]}/>
    <directionalLight ref={sunlight} position={[-12,22,8]} castShadow
      shadow-mapSize={[2048,2048]} shadow-camera-left={-30} shadow-camera-right={30}
      shadow-camera-top={30} shadow-camera-bottom={-30} shadow-camera-far={180}
      shadow-normalBias={.025} shadow-bias={-.00015}/>
  </>;
}

export default function World3D({
  placed,
  period,
  paused,
  cameraZone,
  interactive = true,
  viewReset = 0,
  overlays,
  guideActive = false,
}) {
  const blend = useRef(0);
  const celestial=useRef({to:"none",from:"none",progress:1,fromNight:0,fromDay:0,sun:1,moon:0});
  const guidancePulse = useRef(0);
  const guideElapsed = useRef(0);
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const daylight = useRef(0);
  const sunny = placed.sky && period === "afternoon";
  useFrame((_, dt) => {
    guideElapsed.current = guideActive ? guideElapsed.current + dt : 0;
    guidancePulse.current = reducedMotion ? .5 : .5 - .5 * Math.cos(guideElapsed.current * Math.PI * 2 / 1.8);
    const state=celestial.current;
    const requested=!placed.sky ? "none" : period==="evening" ? "moon" : "sun";
    if (requested!==state.to) {
      state.from=state.to;state.to=requested;state.progress=0;
      state.fromNight=blend.current;state.fromDay=daylight.current;
    }
    state.progress=Math.min(1,state.progress+dt/6.5);
    const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    const p=state.progress;
    const setting=1-ease(p/.45),rising=ease((p-.55)/.45);
    state.sun=requested==="none" ? 1 : state.from==="none" ? (requested==="sun" ? 1 : 0) : state.from==="sun" && p<.45 ? setting : state.to==="sun" ? rising : 0;
    state.moon=state.from==="none" ? (requested==="moon" ? 1 : 0) : state.from==="moon" && p<.45 ? setting : state.to==="moon" ? rising : 0;
    const dawn=state.from==="moon" && requested==="sun" ? ease((p-.15)/.85) : ease(p);
    blend.current=lerp(state.fromNight,requested==="moon" ? 1 : 0,dawn);
    daylight.current=lerp(state.fromDay,requested==="sun" ? 1 : 0,ease(p));
  });
  return (
    <>
      <color attach="background" args={["#a8bad4"]} />
      <Rig cameraZone={cameraZone} interactive={interactive} viewReset={viewReset} />
      <ScreenAnchors overlays={overlays} />
      <Sky blend={blend} daylight={daylight} paused={paused} reducedMotion={reducedMotion} />
      <SunMoon placed={placed.sky} night={period === "evening"} blend={blend} guideActive={guideActive} guidancePulse={guidancePulse} celestial={celestial} />
      <SceneLighting daylight={daylight} blend={blend} celestial={celestial} />
      <DreamySurfaceLight celestial={celestial} lightPosition={CELESTIAL_TOP} />
      <Ground sunny={sunny} streetPlaced={placed.street} guideActive={guideActive} guidancePulse={guidancePulse} />
      <Suspense fallback={null}>
        <UploadedSkyline night={period === "evening"} />
      </Suspense>
      <Pool celestial={celestial} guideActive={guideActive} guidancePulse={guidancePulse} at={NORTH_POOL} active={placed.north} blend={blend} index={1} sunny={sunny} night={period === "evening"} />
      <Pool celestial={celestial} at={SOUTH_POOL} active={true} blend={blend} index={2} sunny={sunny} night={period === "evening"} />
      {GROVE.map(([x, z], i) => (
        <Tree
          key={i}
          position={[x + (hash(i * 5) - 0.5) * 0.5, 0, z + (hash(i * 7) - 0.5) * 0.5]}
          seed={i * 17 + 1}
          scale={0.9 + hash(i * 4) * 0.25}
          night={period === "evening"}
          sunny={sunny}
        />
      ))}
      <Suspense fallback={null}>
        {BUSHES.map(([x, z], i) => (
          <TexturedTree key={"bush-" + i} bush position={[x, .025, z]}
            seed={i} scale={.85 + hash(i + 27) * .3} night={period === "evening"} />
        ))}
      </Suspense>
      <Tree
        position={SURVIVOR_TREE}
        survivor
        seed={392}
        scale={1.2}
        ghost={!placed.tree}
        guideActive={guideActive}
        guidancePulse={guidancePulse}
        night={period === "evening"}
        sunny={sunny}
      />
      <Suspense fallback={<PlaceholderMuseum />}>
        <ReferenceMuseum night={period === "evening"} />
      </Suspense>
      <Suspense fallback={null}>
        <UploadedOculus position={OCULUS} night={period === "evening"} />
      </Suspense>
      <People placed={placed} period={period} paused={paused} />
      <EnchantedDust daylight={daylight} blend={blend} paused={paused} reducedMotion={reducedMotion} />
      <EffectComposer multisampling={0} depthBuffer>
        <AtmosphericHaze daylight={daylight} blend={blend} paused={paused} reducedMotion={reducedMotion} />
        <EnchantedAtmosphere daylight={daylight} blend={blend} lightPosition={CELESTIAL_TOP} celestial={celestial}
          paused={paused} reducedMotion={reducedMotion} />

        <Bloom
          mipmapBlur
          intensity={0.68}
          luminanceThreshold={1.15}
          luminanceSmoothing={0.25}
        />
        <Vignette eskil={false} offset={0.23} darkness={sunny ? 0.08 : 0.31} />
      </EffectComposer>
    </>
  );
}
