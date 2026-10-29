import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertex = `
attribute float phase;
uniform float time;
uniform float screenScale;
varying float opacity;
void main() {
  float t=fract(phase+time*(.6+position.y*.12));
  vec3 p=position;
  float top=mix(-.2,-.04,clamp((p.x+3.55)/7.1,0.,1.));
  float bottom=-1.48;
  if(abs(p.x)<1.0 && abs(p.z)<1.0){top=-1.43;bottom=-2.02;}
  p.y=mix(top,bottom,t*t);
  float splash=smoothstep(.87,1.,t);
  p.x+=sin(phase*153.)*(.008+splash*.025);
  p.z+=cos(phase*117.)*(.008+splash*.025);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(screenScale*(.026+phase*.018)/max(1.,-mv.z),1.25,5.);
  opacity=smoothstep(0.,.08,t)*(1.-smoothstep(.88,1.,t));
}`;
const fragment = `
uniform vec3 waterColor;
varying float opacity;
void main() {
  vec2 p=gl_PointCoord*2.-1.;
  p.x*=2.;
  float a=(1.-smoothstep(.45,1.,dot(p,p)))*opacity*.7;
  if(a<.015) discard;
  gl_FragColor=vec4(waterColor,a);
  #include <colorspace_fragment>
}`;

export default function WaterfallParticles({ night }) {
  const material = useRef();
  const geometry = useMemo(() => {
    const count=6400;
    const positions=new Float32Array(count*3);
    const phases=new Float32Array(count);
    const rand=(i)=>{const x=Math.sin(i*127.1+31.7)*43758.5453;return x-Math.floor(x);};
    for(let i=0;i<count;i++) {
      const side=i%4;
      const inner=i>=5600;
      // Keep the streams on the basin side of the imported wall faces.
      const edge=inner ? .76 : side<2 ? 3.44 : 3.33;
      const along=(rand(i+1)*2-1)*(inner ? .72 : 3.28);
      positions[i*3]=side<2 ? (side===0 ? -edge : edge) : along;
      positions[i*3+1]=rand(i+71);
      positions[i*3+2]=side<2 ? along : (side===2 ? -edge : edge);
      phases[i]=rand(i+137);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.BufferAttribute(positions,3));
    g.setAttribute("phase",new THREE.BufferAttribute(phases,1));
    return g;
  }, []);
  const uniforms=useMemo(()=>({
    time:{value:0}, screenScale:{value:1000},
    waterColor:{value:new THREE.Color("#9edce9")},
  }),[]);
  useEffect(()=>{
    uniforms.waterColor.value.set(night ? "#9dbde9" : "#9edce9");
  },[night,uniforms]);
  useFrame(({gl,camera,size,clock})=>{
    if(!material.current) return;
    material.current.uniforms.time.value=clock.elapsedTime;
    material.current.uniforms.screenScale.value=size.height*gl.getPixelRatio()/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertex}
        fragmentShader={fragment} transparent depthWrite={false} toneMapped={false} />
    </points>
  );
}
