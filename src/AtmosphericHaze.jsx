import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Uniform, Vector3, Matrix4 } from "three";
import { SKYLINE_COUNT, skylinePosition } from "./SkylineLayout.js";

// project the actual curved plaza edge, so the pink band stays above the paving
export function useSkyHorizon() {
  const horizon = useMemo(() => new Float32Array(33).fill(.5), []);
  const points = useMemo(() => Array.from({length: 129}, (_, i) => new Vector3(
    Math.cos(i / 128 * Math.PI) * 48, 0, -2 - Math.sin(i / 128 * Math.PI) * 48
  )), []);
  const projected = useMemo(() => points.map(() => new Vector3()), [points]);
  useFrame(({ camera }) => {
    points.forEach((point, i) => projected[i].copy(point).project(camera));
    for (let column = 0; column < 33; column++) {
      const x = column / 32 * 2 - 1;
      let top = -1;
      for (let i = 0; i < projected.length - 1; i++) {
        const a = projected[i], b = projected[i + 1];
        if ((a.x <= x && b.x >= x) || (b.x <= x && a.x >= x)) {
          const t = (x - a.x) / (b.x - a.x || .00001);
          top = Math.max(top, (a.y + (b.y - a.y) * t + 1) / 2);
        }
      }
      horizon[column] = Math.min(.88, Math.max(.08, top));
    }
  });
  return horizon;
}

export const skyColors = `
uniform float skyHorizon[33];
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
float skyEdge(float x) {
  float edge=skyHorizon[0];
  for(int i=0;i<32;i++){
    float start=float(i)/32.;
    if(x>=start && x<=start+1./32.)
      edge=mix(skyHorizon[i],skyHorizon[i+1],(x-start)*32.);
  }
  return edge;
}
vec3 skyColor(vec2 uv, float daylight, float nightBlend) {
  float edge=skyEdge(uv.x);
  float y=clamp((uv.y-edge)/max(1.-edge,.05),0.,1.);
  vec3 pink=linearRGB(vec3(.96,.77,.92));
  vec3 lilac=linearRGB(vec3(.75,.75,.94));
  vec3 blue=linearRGB(vec3(.36,.75,.88));
  vec3 day=mix(pink,lilac,smoothstep(0.,.48,y));
  day=mix(day,blue,smoothstep(.40,1.,y));
  vec3 mauve=linearRGB(vec3(.73,.63,.76));
  vec3 lavender=linearRGB(vec3(.59,.55,.70));
  vec3 dusk=linearRGB(vec3(.43,.45,.61));
  vec3 waiting=mix(mauve,lavender,smoothstep(0.,.55,y));
  waiting=mix(waiting,dusk,smoothstep(.45,1.,y));
  vec3 night=mix(linearRGB(vec3(.48,.40,.69)),linearRGB(vec3(.30,.32,.57)),smoothstep(0.,.55,y));
  night=mix(night,linearRGB(vec3(.13,.17,.36)),smoothstep(.42,1.,y));
  return mix(mix(waiting,day,daylight),night,nightBlend);
}`;

const fragment = `
uniform float uDay; uniform float uNight;
uniform float uNear; uniform float uFar;
uniform mat4 hazeInverseProjection;
uniform mat4 hazeCameraWorld;
uniform float citySeam[33];
uniform float mistTime;
float mistHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float mistNoise(vec2 p){
  vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mistHash(cell),mistHash(cell+vec2(1.,0.)),f.x),mix(mistHash(cell+vec2(0.,1.)),mistHash(cell+1.),f.x),f.y);
}
float mistLayers(vec2 p){return mistNoise(p)*.6+mistNoise(p*2.13+7.)*.28+mistNoise(p*4.17-3.)*.12;}
float skylineSeam(float x){
  float result=citySeam[0];
  for(int i=0;i<32;i++){
    float left=float(i)/32.;
    if(x>=left && x<=left+1./32.)result=mix(citySeam[i],citySeam[i+1],smoothstep(0.,1.,(x-left)*32.));
  }
  return result;
}
${skyColors}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float depth=readDepth(uv);
  float distanceToCamera=uNear*uFar/(uFar-depth*(uFar-uNear));
  vec4 viewPoint=hazeInverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);
  viewPoint/=viewPoint.w;
  vec3 worldPoint=(hazeCameraWorld*viewPoint).xyz;
  float height=max(0.,worldPoint.y);
  // Blend the building feet and gaps behind them along the actual skyline.
  float radius=length(worldPoint.xz-vec2(0.,2.));
  float cityRing=smoothstep(30.,37.,radius)*(1.-smoothstep(51.,59.,radius));
  float outerCity=max(abs(worldPoint.x+2.)-24.,abs(worldPoint.z)-25.);
  float cityMask=smoothstep(0.,6.,outerCity);
  float wisps=mistLayers(worldPoint.xz*.12+vec2(mistTime*.018,-mistTime*.012));
  float baseMist=cityRing*exp(-height*.4)*cityMask*.85*mix(.5,1.,wisps);
  float seam=skylineSeam(uv.x);
  float cloud=mistLayers(uv*vec2(7.,13.)+vec2(mistTime*.012,0.));
  float seamOffset=(cloud-.5)*.022;
  float seamWidth=mix(.04,.07,cloud);
  float seamMist=exp(-pow((uv.y-seam-seamOffset)/seamWidth,2.))*mix(.45,.9,cloud);
  float skyPixel=step(.99999,depth);
  float distant=skyPixel>0.5 ? 1. : cityMask*smoothstep(30.,55.,distanceToCamera);
  float haze=skyPixel>0.5 ? seamMist*.22 : 1.-(1.-baseMist)*(1.-seamMist*distant*.6);

  float borderBrightness=mix(mix(.48,.60,uDay),.24,uNight);
  vec3 borderColor=skyColor(uv,uDay,uNight)*mix(borderBrightness,1.,skyPixel);
  vec3 dayHaze=linearRGB(vec3(.40,.56,.74));
  borderColor=mix(borderColor,dayHaze,uDay*(1.-uNight)*(1.-skyPixel)*.7);
  vec3 color=mix(inputColor.rgb,borderColor,haze);
  // Dissolve the actual paving edge into the sky, including gaps between buildings.
  float groundRadius=length(worldPoint.xz-vec2(0.,-2.));
  float edgeFade=smoothstep(39.,48.,groundRadius);
  float edgeBand=exp(-pow((uv.y-skyEdge(uv.x))/mix(.045,.075,cloud),2.));
  float groundMist=pow(edgeFade,mix(.9,1.3,wisps))*exp(-height*.55)*cityMask;
  groundMist*=mix(.65,1.,edgeBand);
  groundMist*=1.-skyPixel;
  color=mix(color,skyColor(uv,uDay,uNight),clamp(groundMist,0.,1.));
  outputColor=vec4(color,inputColor.a);
}`;

export default function AtmosphericHaze({ daylight, blend, paused, reducedMotion }) {
  const horizon = useSkyHorizon();
  const seam = useMemo(()=>new Float32Array(33).fill(.45),[]);
  const cityPoints=useMemo(()=>Array.from({length:SKYLINE_COUNT},(_,i)=>new Vector3(...skylinePosition(i).position)),[]);
  const projectedCity=useMemo(()=>cityPoints.map(()=>new Vector3()),[cityPoints]);
  const effect = useMemo(() => new Effect("AtmosphericHaze", fragment, {
    blendFunction: BlendFunction.NORMAL,
    attributes: EffectAttribute.DEPTH,
    uniforms: new Map([
      ["skyHorizon", new Uniform(horizon)],
      ["citySeam", new Uniform(seam)],
      ["mistTime", new Uniform(0)],
      ["uDay", new Uniform(0)], ["uNight", new Uniform(0)],
      ["uNear", new Uniform(.1)], ["uFar", new Uniform(280)],
      ["hazeInverseProjection", new Uniform(new Matrix4())],
      ["hazeCameraWorld", new Uniform(new Matrix4())],
    ]),
  }), [horizon, seam]);
  useFrame(({ camera },dt) => {
    if(!paused && !reducedMotion)effect.uniforms.get("mistTime").value+=Math.min(dt,.05);
    cityPoints.forEach((point,i)=>projectedCity[i].copy(point).project(camera));
    for(let column=0;column<33;column++){
      const x=column/32*2-1;
      let top=-1;
      for(let i=0;i<projectedCity.length-1;i++){
        const a=projectedCity[i],b=projectedCity[i+1];
        if(a.z>1 || b.z>1)continue;
        if((a.x<=x && b.x>=x)||(b.x<=x && a.x>=x)){
          const t=(x-a.x)/(b.x-a.x || .00001);
          top=Math.max(top,(a.y+(b.y-a.y)*t+1)/2);
        }
      }
      seam[column]=top;
    }
    effect.uniforms.get("uDay").value = daylight.current;
    effect.uniforms.get("uNight").value = blend.current;
    effect.uniforms.get("uNear").value = camera.near;
    effect.uniforms.get("uFar").value = camera.far;
    effect.uniforms.get("hazeInverseProjection").value.copy(camera.projectionMatrixInverse);
    effect.uniforms.get("hazeCameraWorld").value.copy(camera.matrixWorld);
  });
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} />;
}
