import { useEffect, useMemo } from "react";
import * as THREE from "three";

// grove lawns from the reference plan, split up to leave paved walking routes
const lawns = [
  [[-19,-18],[-13,-18],[-13,-2],[-18,-1]],
  [[-18,1],[-13,1],[-13,17],[-17,15]],
  [[-11,-2],[-4,-2],[-4,2],[-11,2]],
  [[-11,4],[-6,4],[-6,17],[-11,17]],
  [[-15,19],[-1,19],[-1,20.5],[-12,20.5]],
  // north grove edge and the planted rows east of the North Pool
  [[-11.8,-20.5],[-.8,-20.5],[-.8,-17.2],[-11.8,-17.2]],
  [[1.8,-15.5],[5,-15.5],[5,-8],[1.8,-8]],
  [[6.4,-17],[12,-17],[12,-8],[6.4,-8]],
  // smaller grove beds between the pools, west of the museum
  [[-2.5,-1],[-.3,-1],[-.3,3.5],[-2.5,3.5]],
  // planted southern edge above Liberty Street, leaving a path around the pool
  [[1,17.5],[6,17.5],[6,20.2],[1,20.2]],
  [[7.3,17.5],[12.2,17.5],[12.2,20.2],[7.3,20.2]],
];

export default function ParkLawns({ sunny }) {
  const shapes = useMemo(() => lawns.map((points) => {
    const shape = new THREE.Shape();
    points.forEach(([x,z],i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z));
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.computeBoundingBox();
    const {min,max} = geometry.boundingBox;
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const sage = new THREE.Color("#93b3a2");
    const mint = new THREE.Color("#b8d2c5");
    const highlight = new THREE.Color("#c8d8bb");
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = (position.getX(i) - min.x) / (max.x - min.x);
      const y = (position.getY(i) - min.y) / (max.y - min.y);
      color.copy(sage).lerp(mint, y).lerp(highlight, x * .45);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }), []);
  const texture = useMemo(() => {
    const canvas=document.createElement("canvas");
    canvas.width=canvas.height=256;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#f4f7f3";ctx.fillRect(0,0,256,256);
    for(let i=0;i<14000;i++) {
      const rand=(n)=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};
      const x=rand(i*3+1)*256,y=rand(i*3+2)*256;
      ctx.strokeStyle=i%3===0 ? "#ffffff55" : i%3===1 ? "#54796318" : "#d9eddf55";
      ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1,y-1-rand(i+7)*3);ctx.stroke();
    }
    const tex=new THREE.CanvasTexture(canvas);
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.repeat.set(.6,.6);
    return tex;
  }, []);
  useEffect(()=>()=>texture.dispose(),[texture]);
  useEffect(()=>()=>shapes.forEach(geometry => geometry.dispose()),[shapes]);
  return <group>{shapes.map((shape,i)=>(
    <mesh key={i} geometry={shape} rotation={[-Math.PI/2,0,0]} position={[0,.025,0]} receiveShadow>
      <meshStandardMaterial map={texture} vertexColors color={sunny ? "#ffffff" : "#edf5f1"} roughness={1} />
    </mesh>
  ))}</group>;
}
