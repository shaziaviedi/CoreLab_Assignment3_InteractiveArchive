import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import * as THREE from "three";
import { SKYLINE_COUNT, skylinePosition } from "./SkylineLayout.js";

const atmosphere = `
uniform float enchantTime;
uniform float enchantDay;
uniform float enchantNight;
uniform float enchantPresence;
uniform vec2 enchantLight;
uniform vec2 enchantPixel;
uniform vec3 enchantTint;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float depth=readDepth(uv);
  vec2 ray=uv-enchantLight;
  float angle=atan(ray.x,-ray.y);
  float drift=enchantTime*.025;
  float frequency=mix(19.,9.,enchantNight);
  float bands=pow(.5+.5*sin(angle*frequency+sin(angle*7.+drift)*1.2),mix(10.,3.5,enchantNight));
  bands+=pow(.5+.5*sin(angle*mix(31.,15.,enchantNight)-drift),mix(18.,7.,enchantNight))*.35;
  float cone=(1.-smoothstep(-.5,.18,ray.y))*(1.-smoothstep(.15,1.3,length(ray)));
  // Sample towards the light so solid silhouettes interrupt the shafts.
  float visibility=1.;
  for(int i=1;i<=8;i++){
    vec2 sampleUv=mix(uv,enchantLight,float(i)/10.);
    sampleUv=clamp(sampleUv,vec2(.001),vec2(.999));
    float blocker=readDepth(sampleUv);
    visibility*=mix(.82,1.,step(depth-.001,blocker));
  }
  float strength=mix(.022,.075,enchantDay);
  strength=mix(strength,.025,enchantNight);
  float shafts=bands*cone*visibility*strength*smoothstep(.055,mix(.11,.2,enchantNight),length(ray))*enchantPresence;

  // Soft silhouette light separates the city from the mist.
  float edge=0.;
  vec2 offset=enchantPixel*2.;
  edge+=step(depth+.0003,readDepth(clamp(uv+vec2(offset.x,0.),vec2(0.),vec2(1.))));
  edge+=step(depth+.0003,readDepth(clamp(uv+vec2(0.,offset.y),vec2(0.),vec2(1.))));
  edge*=step(depth,.9999);
  float rim=edge*mix(.012,.022,enchantNight)*enchantPresence;
  vec3 glow=enchantTint*(shafts+rim);
  // Leave the sky gradients and the underlying material hues intact.
  vec3 color=inputColor.rgb+glow*(1.-clamp(inputColor.rgb,0.,1.));
  outputColor=vec4(color,inputColor.a);
}`;

export function EnchantedAtmosphere({ daylight, blend, lightPosition, celestial, paused, reducedMotion }) {
  const effect=useMemo(()=>new Effect("EnchantedAtmosphere",atmosphere,{
    blendFunction:BlendFunction.NORMAL,
    attributes:EffectAttribute.DEPTH,
    uniforms:new Map([
      ["enchantTime",new THREE.Uniform(0)],
      ["enchantDay",new THREE.Uniform(0)],
      ["enchantNight",new THREE.Uniform(0)],
      ["enchantPresence",new THREE.Uniform(0)],
      ["enchantLight",new THREE.Uniform(new THREE.Vector2(.7,.85))],
      ["enchantPixel",new THREE.Uniform(new THREE.Vector2())],
      ["enchantTint",new THREE.Uniform(new THREE.Color("#ded5ed"))],
    ]),
  }),[]);
  const projected=useMemo(()=>new THREE.Vector3(),[]);
  const colors=useMemo(()=>["#ded5ed","#fff0cf","#c0d8ff"].map(c=>new THREE.Color(c)),[]);
  useFrame(({camera,size,gl},dt)=>{
    const u=effect.uniforms;
    if(!paused && !reducedMotion)u.get("enchantTime").value+=Math.min(dt,.05);
    u.get("enchantDay").value=daylight.current;
    u.get("enchantNight").value=blend.current;
    const state=celestial.current;
    const altitude=state.sun>=state.moon ? state.sun : state.moon;
    const active=state.to!=="none";
    u.get("enchantPresence").value=active ? THREE.MathUtils.smoothstep(altitude,.25,.9) : 0;
    projected.copy(lightPosition);
    projected.y-=45*(1-altitude);
    projected.project(camera);
    u.get("enchantLight").value.set(projected.x*.5+.5,projected.y*.5+.5);
    const ratio=gl.getPixelRatio();
    u.get("enchantPixel").value.set(1/(size.width*ratio),1/(size.height*ratio));
    u.get("enchantTint").value.copy(colors[0]).lerp(colors[1],daylight.current).lerp(colors[2],blend.current);
  });
  useEffect(()=>()=>effect.dispose(),[effect]);
  return <primitive object={effect} />;
}

const dustVertex=`
attribute float seed;
uniform float dustTime;
uniform float dustScale;
varying float dustOpacity;
varying float dustSeed;
void main(){
  dustSeed=seed;
  vec3 p=position;
  p.x+=sin(dustTime*.12+seed*63.)*.45;
  p.z+=cos(dustTime*.09+seed*37.)*.35;
  p.y+=sin(dustTime*.17+seed*91.)*.3;
  vec4 view=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*view;
  gl_PointSize=clamp(dustScale*(.024+seed*.026)*mix(1.,2.6,step(.75,seed))/max(1.,-view.z),1.4,8.);
  dustOpacity=(.25+.75*pow(.5+.5*sin(dustTime*.7+seed*71.),3.))*smoothstep(5.,14.,-view.z);
}`;
const dustFragment=`
uniform float dustStrength;
uniform vec3 dustColor;
varying float dustOpacity;
varying float dustSeed;
void main(){
  vec2 p=gl_PointCoord*2.-1.;
  float core=exp(-dot(p,p)*7.);
  float halo=(1.-smoothstep(.05,1.,dot(p,p)))*.2;
  float crossGlow=exp(-abs(p.x)*35.-abs(p.y)*4.)+exp(-abs(p.y)*35.-abs(p.x)*4.);
  float star=step(.75,dustSeed)*crossGlow*.45;
  float alpha=(core+halo+star)*dustOpacity*dustStrength;
  if(alpha<.008)discard;
  gl_FragColor=vec4(dustColor*1.7,alpha);
  #include <colorspace_fragment>
}`;

export function EnchantedDust({ daylight, blend, paused, reducedMotion }) {
  const material=useRef();
  const geometry=useMemo(()=>{
    const count=420,positions=new Float32Array(count*3),seeds=new Float32Array(count);
    const rand=i=>{const n=Math.sin(i*127.1+19.3)*43758.5453;return n-Math.floor(n);};
    for(let i=0;i<count;i++){
      positions.set([-20+rand(i*3)*43,.6+rand(i*3+1)*7,-24+rand(i*3+2)*44],i*3);
      if(i>=280){
        const {position}=skylinePosition((i-280)%SKYLINE_COUNT);
        positions.set([position[0]+(rand(i+3)-.5)*5,.7+rand(i+9)*6,position[2]+(rand(i+7)-.5)*4],i*3);
      }
      seeds[i]=rand(i+1401);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.BufferAttribute(positions,3));
    g.setAttribute("seed",new THREE.BufferAttribute(seeds,1));
    return g;
  },[]);
  const uniforms=useMemo(()=>({dustTime:{value:0},dustScale:{value:1000},dustStrength:{value:.2},dustColor:{value:new THREE.Color("#ded5ed")}}),[]);
  const colors=useMemo(()=>["#ded5ed","#fff0cf","#c0d8ff"].map(c=>new THREE.Color(c)),[]);
  useFrame(({camera,size,gl},dt)=>{
    if(!material.current)return;
    if(!paused && !reducedMotion)uniforms.dustTime.value+=Math.min(dt,.05);
    uniforms.dustScale.value=size.height*gl.getPixelRatio()/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
    uniforms.dustStrength.value=THREE.MathUtils.lerp(THREE.MathUtils.lerp(.43,.36,daylight.current),.65,blend.current);
    uniforms.dustColor.value.copy(colors[0]).lerp(colors[1],daylight.current).lerp(colors[2],blend.current);
  });
  return <points geometry={geometry} frustumCulled={false}>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={dustVertex} fragmentShader={dustFragment}
      transparent depthWrite={false} toneMapped={false} />
  </points>;
}
