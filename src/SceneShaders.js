import { skyColors } from "./AtmosphericHaze.jsx";

export const skyVert = `varying vec2 vSkyUv;
void main(){vSkyUv=uv;gl_Position=vec4(position.xy,1.,1.);}`;
export const skyFrag = `precision highp float;
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
  // broken cloud banks behind the skyline
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
export const waterVert = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const waterFrag = `precision highp float; varying vec2 vUv;uniform float uTime;uniform float uNight;uniform float uDay;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float n2(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 uv=vUv;float ripple=sin((uv.x+uv.y)*35.-uTime*.93)*.017+sin(uv.x*95.+uTime*.43)*.009;
float waves=n2(uv*22.+uTime*.07);vec3 dark=mix(vec3(.020,.075,.12),vec3(.015,.047,.08),uNight);
dark=mix(dark,vec3(.035,.16,.22),uDay);
float brightness=clamp(waves*.10+ripple+.022,0.,1.);vec3 color=dark+vec3(.27,.45,.54)*brightness;
float foam=max(smoothstep(.95,1.,uv.x),smoothstep(.95,1.,uv.y))*0.18;
color+=vec3(.33,.55,.67)*foam;gl_FragColor=vec4(color,1.);}`;
export const fallVert = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
export const fallFrag = `precision mediump float;varying vec2 vUv;uniform float uTime;uniform float uNight;
float hash(float x){return fract(sin(x*43.758)*13842.23);}
void main(){float streak=sin(vUv.x*530.+sin(uTime*1.8+vUv.x*60.)*1.5)*.5+.5;
float foam=sin(vUv.y*90.-uTime*13.+hash(floor(vUv.x*65.))*6.28)*.5+.5;
float a=.2+.35*pow(streak,5.)+.13*foam;
vec3 c=mix(vec3(.56,.82,.94),vec3(.58,.67,.95),uNight);gl_FragColor=vec4(c,a);}`;
