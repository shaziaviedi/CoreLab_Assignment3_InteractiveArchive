import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { OBS } from "./data.js";

const PI = Math.PI,
  TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (x) => {
  let v = Math.sin(x * 127.1 + 14.4) * 43758.5453;
  return v - Math.floor(v);
};

export const OVERVIEW = { pos: [16, 22, 31], target: [0, 0, 0] };
const NORTH_POOL = [-8, 0.03, 1];
const SOUTH_POOL = [-3.5, 0.03, 8.5];
const SURVIVOR_TREE = [2, 0, -0.5];
const STREET_X = 9;
const CROSSWALK_Z = -2;
const OCULUS = [15.5, 0.05, 0];
// keep sun/moon in the same screen spot; coords here are NDC, not world coords
const SKY_NDC = [0.42, 0.66];
const SKY_DISTANCE = 60;

// 3D points for the HTML slots, camera pins + stats to follow
const ANCHORS = {
  north: { at: [-8, 0.5, 1], card: "left", cardAt: [-11.2, 0.5, 1] },
  tree: { at: [2, 4.4, -0.5], card: "above", cardAt: [2, 6.6, -0.5] },
  street: { at: [STREET_X, 0.1, CROSSWALK_Z], card: "right" },
};

const ROUTES = {
  north: { a: [-4.3, -3.5], b: [-4.3, 4.6] },
  tree: { a: [3.6, -4.5], b: [3.6, 3.6] },
  street: { a: [5.6, CROSSWALK_Z], b: [12.4, CROSSWALK_Z] },
};

const CAMERA_PRESETS = {
  north: { pos: [1.8, 2.7, -4.2], target: [-8, 0, 1] },
  tree: { pos: [6.3, 1.7, 10], target: [2, 3, -0.5] },
  street: { pos: [10.5, 1.75, 7.5], target: [8.6, 0.9, -5] },
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
  return (
    x > 4.6 ||
    (z > 5.5 && x > -9.5) ||
    (x > -5.5 && z > -3.2) ||
    inBox(x, z, NORTH_POOL, 4.7) ||
    inBox(x, z, SOUTH_POOL, 4.7) ||
    Math.hypot(x - SURVIVOR_TREE[0], z - SURVIVOR_TREE[2]) < 3.6 ||
    (Math.abs(x - ROUTES.north.a[0]) < 1.4 && z > -5 && z < 5.6) ||
    (Math.abs(x - ROUTES.tree.a[0]) < 1.5 && z > -6 && z < 5) ||
    Object.values(CAMERA_PRESETS).some((p) => nearSightline(x, z, p))
  );
}
const GROVE = [];
for (let row = 0; row < 8; row++)
  for (let col = 0; col < 8; col++) {
    const x = -17 + col * 3.2 + (row % 2) * 1.6,
      z = -13 + row * 3.2;
    if (!inClearing(x, z)) GROVE.push([x, z]);
  }
const skyVert = `varying vec3 vDir; void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFrag = `precision highp float;
varying vec3 vDir;uniform float uNight;uniform float uTime;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.52;for(int i=0;i<5;i++){v+=a*noise2(p);p=p*2.12+vec2(14.,5.);a*=.47;}return v;}
void main(){vec3 d=normalize(vDir);float horizon=clamp(d.y*.5+.5,0.,1.);float n=uNight;
vec3 high=mix(vec3(.26,.65,.82),vec3(.085,.098,.30),n);
vec3 mid=mix(vec3(.79,.57,.85),vec3(.26,.24,.52),n);
vec3 low=mix(vec3(1.,.70,.67),vec3(.55,.37,.70),n);
vec3 color=mix(low,mid,smoothstep(.38,.70,horizon));color=mix(color,high,smoothstep(.61,.98,horizon));
vec2 p=d.xz/(d.y+.95);p*=1.55;float cloud=fbm(p*1.2+vec2(uTime*.006,2.));float fine=fbm(p*2.8+vec2(uTime*.004,11.));
float cf=smoothstep(.36,.70,cloud+.17*fine);
color=mix(color,mix(vec3(1.,.85,.95),vec3(.56,.52,.79),n),cf*.32);
color+=vec3(.15,.09,.12)*exp(-pow((horizon-.52)/.16,2.));
float star=step(.9983,hash21(floor(p*130.)))*smoothstep(.4,1.,horizon)*n;
color+=vec3(1.,.93,.79)*star*.7;
gl_FragColor=vec4(color,1.);}`;
const waterVert = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const waterFrag = `precision highp float; varying vec2 vUv;uniform float uTime;uniform float uNight;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float n2(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 uv=vUv;float ripple=sin((uv.x+uv.y)*35.-uTime*.93)*.017+sin(uv.x*95.+uTime*.43)*.009;
float waves=n2(uv*22.+uTime*.07);vec3 dark=mix(vec3(.020,.075,.12),vec3(.015,.047,.08),uNight);
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

function Sky({ blend }) {
  const ref = useRef();
  const uniforms = useMemo(
    () => ({ uNight: { value: 0 }, uTime: { value: 0 } }),
    [],
  );
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.uniforms.uNight.value = blend.current;
      ref.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });
  return (
    <mesh renderOrder={-1000}>
      <sphereGeometry args={[120, 64, 32]} />
      <shaderMaterial
        ref={ref}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={skyVert}
        fragmentShader={skyFrag}
      />
    </mesh>
  );
}
function skyPoint(camera, ndcY, out) {
  return out
    .set(SKY_NDC[0], ndcY, 0.5)
    .unproject(camera)
    .sub(camera.position)
    .normalize()
    .multiplyScalar(SKY_DISTANCE)
    .add(camera.position);
}
function SunMoon({ placed, night, blend }) {
  let sun = useRef(),
    moon = useRef();
  const { camera } = useThree();
  useFrame(() => {
    const b = blend.current,
      high = SKY_NDC[1],
      low = SKY_NDC[1] - 0.6;
    skyPoint(camera, lerp(high, low, b), sun.current.position);
    sun.current.visible = placed && b < 0.97;
    skyPoint(camera, lerp(low, high, b), moon.current.position);
    moon.current.visible = placed && b > 0.03;
  });
  return (
    <group>
      <mesh ref={sun}>
        <sphereGeometry args={[2.3, 48, 32]} />
        <meshBasicMaterial color={[1.55, 1.3, 0.95]} toneMapped={false} fog={false} />
      </mesh>
      <mesh ref={moon}>
        <sphereGeometry args={[1.7, 48, 32]} />
        <meshBasicMaterial color={[1.2, 1.25, 1.55]} toneMapped={false} fog={false} />
      </mesh>
      <pointLight
        position={[12, 14, -3]}
        intensity={6}
        distance={56}
        color={night ? "#c1c6ff" : "#ffe3c9"}
      />
    </group>
  );
}
function Ground() {
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
    t.repeat.set(27, 27);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      <mesh rotation={[-PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={tex} color="#f4ebf7" roughness={0.98} />
      </mesh>
      <mesh
        rotation={[-PI / 2, 0, 0]}
        position={[STREET_X, 0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[6, 170]} />
        <meshStandardMaterial color="#9699b4" roughness={0.96} />
      </mesh>
      {Array.from({ length: 21 }, (_, i) => -64 + i * 6)
        .filter((z) => Math.abs(z - CROSSWALK_Z) > 2.5)
        .map((z) => (
          <mesh
            key={z}
            rotation={[-PI / 2, 0, 0]}
            position={[STREET_X, 0.028, z]}
          >
            <planeGeometry args={[0.09, 2.1]} />
            <meshBasicMaterial color="#efedf2" transparent opacity={0.4} />
          </mesh>
        ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={"zebra" + i}
          rotation={[-PI / 2, 0, 0]}
          position={[STREET_X - 2.45 + i * 0.7, 0.03, CROSSWALK_Z]}
          receiveShadow
        >
          <planeGeometry args={[0.36, 2.2]} />
          <meshStandardMaterial
            color="#eeeaf2"
            transparent
            opacity={0.55}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
function Pool({ at, active, blend, index }) {
  let water = useRef(),
    waterU = useMemo(() => ({ uTime: { value: 0 }, uNight: { value: 0 } }), []);
  let fallU = useMemo(
    () => ({ uTime: { value: 0 }, uNight: { value: 0 } }),
    [],
  );
  useFrame(({ clock }) => {
    waterU.uTime.value = clock.elapsedTime;
    waterU.uNight.value = blend.current;
    fallU.uTime.value = clock.elapsedTime;
    fallU.uNight.value = blend.current;
  });
  const rail = 5.85,
    inner = 4.75;
  return (
    <group position={at}>
      <mesh castShadow receiveShadow position={[0, 0.14, 0]}>
        <boxGeometry args={[rail, 0.31, rail]} />
        <meshStandardMaterial
          color="#242834"
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
        <planeGeometry args={[1.75, 1.75]} />
        <meshBasicMaterial color="#040912" toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        let along = i < 2;
        let p = along
          ? [0, 0.42, (i === 0 ? -1 : 1) * 2.91]
          : [(i === 2 ? -1 : 1) * 2.91, 0.42, 0];
        return (
          <mesh key={"rail" + i} position={p} castShadow>
            <boxGeometry
              args={
                along ? [rail + 0.14, 0.23, 0.24] : [0.24, 0.23, rail + 0.14]
              }
            />
            <meshStandardMaterial
              color="#4a4850"
              metalness={0.6}
              roughness={0.25}
            />
          </mesh>
        );
      })}
      {[0, 1, 2, 3].map((i) => {
        let p =
          i < 2
            ? [0, -0.1, i === 0 ? -2.27 : 2.27]
            : [i === 2 ? -2.27 : 2.27, -0.1, 0];
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
function Tree({
  position,
  scale = 1,
  seed = 12,
  ghost = false,
  night = false,
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
          color={ghost ? "#b7a4cf" : "#706071"}
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
            color="#776472"
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
                    0.34 + hash(i + seed) * 0.1,
                    0.18 + 0.08 * hash(i),
                    night ? 0.43 : 0.61,
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
function Oculus() {
  return (
    <group position={OCULUS}>
      {Array.from({ length: 17 }, (_, i) => {
        let z = -3.8 + i * 0.49;
        return (
          <mesh
            key={i}
            position={[0, 1.1, z]}
            rotation={[0, 0, -0.28 + Math.abs(i - 8) * 0.035]}
            castShadow
          >
            <boxGeometry args={[0.11, 2.5, 0.12]} />
            <meshStandardMaterial
              color="#f8f3f9"
              metalness={0.22}
              roughness={0.47}
            />
          </mesh>
        );
      })}
    </group>
  );
}
function Buildings({ night }) {
  let buildings = useMemo(
    () =>
      Array.from({ length: 23 }, (_, i) => {
        let x = -29 + i * 3.3,
          z = -28 - (i % 3) * 1.5,
          hh = 4 + hash(i * 21) * 17;
        return { x, z, hh, w: 2.5 + hash(i * 9) * 1.7 };
      }),
    [],
  );
  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={i} castShadow position={[b.x, b.hh / 2 - 0.3, b.z]}>
          <boxGeometry args={[b.w, b.hh, b.w * 0.82]} />
          <meshStandardMaterial
            color={night ? "#7e7b9f" : "#b9adbc"}
            transparent
            opacity={0.52}
            metalness={0.14}
            roughness={0.63}
          />
        </mesh>
      ))}
    </group>
  );
}
function Person({ zone, index, data, paused, night, enabled, simTime }) {
  const ref = useRef(),
    flashRef = useRef();
  const route = ROUTES[zone];
  const style = useMemo(
    () => ({
      head: "#c2a99e",
      coat: ["#6a697c", "#7d7a99", "#d0b5bc", "#8a91a2", "#5d6b83"][index % 5],
    }),
    [index],
  );
  useFrame(({ clock }) => {
    if (!ref.current) return;
    let t = simTime.current;
    let seed = hash(
      index * 31 + (zone === "north" ? 1 : zone === "tree" ? 2 : 3),
    );
    let speed =
      (0.19 + 0.14 * hash(index * 12)) *
      Math.max(0.65, Math.min(1.3, data.crossings / 23));
    let alpha = enabled ? 1 : 0.12;
    let f = (t * speed * 0.2 + seed) % 1;
    let stopped = hash(index * 3 + 99) < Math.min(0.56, data.stops / 76);
    if (stopped) f = 0.1 + hash(index * 8) * 0.78;
    const dx = route.b[0] - route.a[0],
      dz = route.b[1] - route.a[1],
      len = Math.hypot(dx, dz),
      side = ((index % 3) - 1) * 0.38;
    let x = lerp(route.a[0], route.b[0], f) - (dz / len) * side,
      z = lerp(route.a[1], route.b[1], f) + (dx / len) * side;
    ref.current.position.set(x, 0.08, z);
    ref.current.rotation.y = Math.atan2(dx, dz);
    ref.current.visible =
      index < (enabled ? Math.round(5 + data.crossings * 0.26) : 3);
    ref.current.scale.setScalar(1);
    if (flashRef.current)
      flashRef.current.visible =
        enabled &&
        stopped &&
        index / 24 < data.photographing / Math.max(1, data.stops) &&
        Math.sin(t * 3 + index * 2.6) > 0.984;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.105, 10, 8]} />
        <meshStandardMaterial color={style.head} roughness={1} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.35, 4, 8]} />
        <meshStandardMaterial color={style.coat} roughness={1} />
      </mesh>
      <mesh position={[-0.055, 0.04, 0]}>
        <boxGeometry args={[0.075, 0.24, 0.08]} />
        <meshStandardMaterial color="#55566d" />
      </mesh>
      <mesh position={[0.055, 0.04, 0]}>
        <boxGeometry args={[0.075, 0.24, 0.08]} />
        <meshStandardMaterial color="#55566d" />
      </mesh>
      <mesh ref={flashRef} position={[0, 0.62, 0.2]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial color={[4, 4, 3.6]} toneMapped={false} />
      </mesh>
    </group>
  );
}
function People({ placed, period, paused }) {
  const d = OBS[period];
  const simTime = useRef(0);
  useFrame((_, dt) => {
    if (!paused) simTime.current += dt;
  });
  return (
    <group>
      {["north", "tree", "street"].map((zone) =>
        Array.from({ length: 24 }, (_, i) => (
          <Person
            key={zone + i}
            zone={zone}
            index={i}
            data={d[zone]}
            enabled={placed[zone]}
            night={period === "evening"}
            paused={paused}
            simTime={simTime}
          />
        )),
      )}
    </group>
  );
}
function Sparkles({ night }) {
  const coords = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => [
        hash(i * 19) * 36 - 18,
        1 + hash(i * 7) * 10,
        hash(i * 13) * 27 - 12,
      ]),
    [],
  );
  const group = useRef();
  useFrame(({ clock }) => {
    if (group.current)
      group.current.rotation.y = Math.sin(clock.elapsedTime * 0.08) * 0.003;
  });
  return (
    <group ref={group}>
      {coords.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.014 + hash(i * 17) * 0.026, 4, 4]} />
          <meshBasicMaterial
            color={i % 3 === 0 ? "#fff4d9" : "#f5e4ff"}
            transparent
            opacity={night ? 0.85 : 0.45}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
// widen the lens on narrow screens, then back up if needed to keep the plaza in view
const BASE_FOV = 42,
  MAX_FOV = 75,
  FIT_ASPECT = 1.3,
  FOG_NEAR = 21,
  FOG_FAR = 85;
const deg = THREE.MathUtils.degToRad;
function Rig({ cameraZone }) {
  const { camera, scene } = useThree();
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
    if (scene.fog) {
      scene.fog.near = FOG_NEAR * pullBack;
      scene.fog.far = FOG_FAR * pullBack;
    }
    let k = Math.min(1, dt * 1.2);
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
    const dock = document.querySelector(".fragment-dock");
    const floor = (dock ? dock.getBoundingClientRect().top : size.height) - 14;
    const taken = [];
    const cards = [];
    for (const key in els) {
      const [kind, zone] = key.split(":");
      if (kind === "stats") {
        cards.push([els[key], zone]);
        continue;
      }
      const [x, y] =
        zone === "sky"
          ? toScreen(_anchor.set(SKY_NDC[0], SKY_NDC[1], 0))
          : toScreen(_anchor.set(...ANCHORS[zone].at).project(camera));
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

export default function World3D({
  placed,
  period,
  paused,
  cameraZone,
  overlays,
}) {
  const blend = useRef(0);
  useFrame((_, dt) => {
    blend.current = lerp(
      blend.current,
      period === "evening" ? 1 : 0,
      Math.min(1, dt * 0.35),
    );
  });
  return (
    <>
      <color attach="background" args={["#a8bad4"]} />
      <fog
        attach="fog"
        args={[period === "evening" ? "#70688f" : "#e4bcd7", FOG_NEAR, FOG_FAR]}
      />
      <Rig cameraZone={cameraZone} />
      <ScreenAnchors overlays={overlays} />
      <Sky blend={blend} />
      <SunMoon placed={placed.sky} night={period === "evening"} blend={blend} />
      <ambientLight
        intensity={period === "evening" ? 0.88 : 1.65}
        color={period === "evening" ? "#bdc5f7" : "#fff2e6"}
      />
      <directionalLight
        position={[-12, 22, 8]}
        intensity={period === "evening" ? 2 : 3}
        color={period === "evening" ? "#c9cafa" : "#fff1df"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <Ground />
      <Buildings night={period === "evening"} />
      <Pool at={NORTH_POOL} active={placed.north} blend={blend} index={1} />
      <Pool at={SOUTH_POOL} active={true} blend={blend} index={2} />
      {GROVE.map(([x, z], i) => (
        <Tree
          key={i}
          position={[x + (hash(i * 5) - 0.5) * 0.5, 0, z + (hash(i * 7) - 0.5) * 0.5]}
          seed={i * 17 + 1}
          scale={0.9 + hash(i * 4) * 0.25}
          night={period === "evening"}
        />
      ))}
      <Tree
        position={SURVIVOR_TREE}
        seed={392}
        scale={1.65}
        ghost={!placed.tree}
        night={period === "evening"}
      />
      <Oculus />
      <People placed={placed} period={period} paused={paused} />
      <Sparkles night={period === "evening"} />
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={0.68}
          luminanceThreshold={1.15}
          luminanceSmoothing={0.25}
        />
        <Vignette eskil={false} offset={0.23} darkness={0.31} />
      </EffectComposer>
    </>
  );
}
