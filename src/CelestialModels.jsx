import { useMemo } from "react";
import { Color } from "three";

export function PastelSun({ placed }) {
  const uniforms = useMemo(() => ({
    sunOpacity: {value: 1},
    haloColor: {value: new Color("#ffe5b3")},
  }), []);
  return (
    <group>
      <mesh position={[0, 0, -.02]} visible={Boolean(placed)}>
        <planeGeometry args={[23, 23]} />
        <shaderMaterial uniforms={uniforms} transparent depthWrite={false} toneMapped={false}
          vertexShader={`varying vec2 haloUv; void main(){haloUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`varying vec2 haloUv; uniform float sunOpacity; uniform vec3 haloColor;
            void main(){
              float r=length((haloUv-.5)*2.);
              float halo=exp(-r*r*5.)*(1.-smoothstep(.7,1.,r));
              gl_FragColor=vec4(haloColor,halo*.36*sunOpacity);
            }`} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.3, 64, 48]} />
        <shaderMaterial uniforms={{sunOpacity:{value:placed ? 1 : .24},sunPlaced:{value:placed ? 1 : 0}}} transparent depthWrite={false} toneMapped={false}
          vertexShader={`varying vec3 sunNormal;void main(){sunNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
          fragmentShader={`uniform float sunOpacity;uniform float sunPlaced;varying vec3 sunNormal;
            void main(){
              vec3 n=normalize(sunNormal);
              float light=smoothstep(-.4,1.,dot(n,normalize(vec3(-.35,.5,1.))));
              vec3 cream=vec3(1.65,1.5,1.13),gold=vec3(1.08,.86,.55);
              gl_FragColor=vec4(mix(vec3(.72,.69,.77),mix(gold,cream,light),sunPlaced),sunOpacity);
            }`} />
      </mesh>
    </group>
  );
}

export const moonVertex=`varying vec3 moonNormal;
void main(){moonNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const moonFragment=`uniform float moonOpacity; varying vec3 moonNormal;
void main(){
  vec3 n=normalize(moonNormal);
  // an offset circular shadow leaves a clean C-shaped illuminated rim
  float shadowDistance=length(n.xy-vec2(.35,.12));
  float crescent=smoothstep(.85,.89,shadowDistance);
  vec3 dark=vec3(.035,.045,.115);
  vec3 pearl=vec3(1.8,1.7,1.35);
  gl_FragColor=vec4(mix(dark,pearl,crescent),moonOpacity);
}`;

export function MoonGlow() {
  const uniforms=useMemo(()=>({moonOpacity:{value:1}}),[]);
  return <mesh position={[0,0,-.03]}>
    <planeGeometry args={[12,12]}/>
    <shaderMaterial uniforms={uniforms} transparent depthWrite={false} toneMapped={false}
      vertexShader={`varying vec2 haloUv;void main(){haloUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`varying vec2 haloUv;uniform float moonOpacity;void main(){
        float r=length((haloUv-.5)*2.);
        float ring=exp(-pow((r-.31)/.1,2.))*.07;
        float glow=exp(-r*r*5.)*(1.-smoothstep(.7,1.,r))*.14;
        gl_FragColor=vec4(.68,.75,1.,(ring+glow)*moonOpacity);
      }`} />
  </mesh>;
}
