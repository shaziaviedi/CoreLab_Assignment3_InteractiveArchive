import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Uniform, Vector3 } from "three";

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
${skyColors}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float depth=readDepth(uv);
  float distanceToCamera=uNear*uFar/(uFar-depth*(uFar-uNear));
  // keep the plaza clear; only distant buildings get a little sky-coloured haze
  float haze=smoothstep(55.,130.,distanceToCamera)*.16;
  if(depth>=.99999) haze=0.;
  outputColor=vec4(mix(inputColor.rgb,skyColor(uv,uDay,uNight),haze),inputColor.a);
}`;

export default function AtmosphericHaze({ daylight, blend }) {
  const horizon = useSkyHorizon();
  const effect = useMemo(() => new Effect("AtmosphericHaze", fragment, {
    blendFunction: BlendFunction.NORMAL,
    attributes: EffectAttribute.DEPTH,
    uniforms: new Map([
      ["skyHorizon", new Uniform(horizon)],
      ["uDay", new Uniform(0)], ["uNight", new Uniform(0)],
      ["uNear", new Uniform(.1)], ["uFar", new Uniform(280)],
    ]),
  }), [horizon]);
  useFrame(({ camera }) => {
    effect.uniforms.get("uDay").value = daylight.current;
    effect.uniforms.get("uNight").value = blend.current;
    effect.uniforms.get("uNear").value = camera.near;
    effect.uniforms.get("uFar").value = camera.far;
  });
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} />;
}
