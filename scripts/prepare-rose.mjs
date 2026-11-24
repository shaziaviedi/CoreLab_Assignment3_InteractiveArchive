// Convert the supplied legacy specular/gloss GLB to supported PBR, retaining every
// triangle and UV. Petal islands are identified from their original red texture.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const input = process.argv[2] ?? 'public/models/rose_3d.glb';
const bytes = await fs.readFile(input);
const length = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.subarray(20, 20 + length));
const binary = bytes.subarray(28 + length);
const image = json.bufferViews[json.images[0].bufferView];
const {data, info} = await sharp(binary.subarray(image.byteOffset, image.byteOffset + image.byteLength)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const petal = (offset) => data[offset] > data[offset+1] * 1.6 && data[offset] > data[offset+2] * 1.5;
function read(index, width) {
  const a=json.accessors[index], v=json.bufferViews[a.bufferView];
  return Array.from({length:a.count}, (_,i)=>Array.from({length:width},(_,c)=>
    binary[a.componentType===5126?'readFloatLE':'readUInt32LE']((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??width*4)+c*4)));
}
const primitive = json.meshes[0].primitives[0];
const positions=read(primitive.attributes.POSITION,3), uv=read(primitive.attributes.TEXCOORD_0,2), indices=read(primitive.indices,1).flat();
const adj=positions.map(()=>[]);
for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3);adj[a].push(b,c);adj[b].push(a,c);adj[c].push(a,b);}
const kinds=[], seen=new Set();
for(let i=0;i<positions.length;i++) {
  if(seen.has(i))continue;
  const group=[i];seen.add(i);
  for(let n=0;n<group.length;n++)for(const k of adj[group[n]])if(!seen.has(k)){seen.add(k);group.push(k);}
  const red=group.filter(k=>{const [u,v]=uv[k];return petal((Math.min(info.height-1,Math.floor(v*info.height))*info.width+Math.min(info.width-1,Math.floor(u*info.width)))*4)}).length;
  const span=[0,1,2].map(d=>Math.max(...group.map(k=>positions[k][d]))-Math.min(...group.map(k=>positions[k][d])));
  const kind=red>group.length/2?'bloom':span[1]>2?'stem':'leaves';
  group.forEach(k=>kinds[k]=kind);
}
// Neutralize petals only. Their luminance variation/veining survives all tints;
// green pixels (including stem, leaves and sepals) remain byte-for-byte intact.
for(let i=0;i<data.length;i+=4)if(petal(i)) {
  const value=Math.round(180+data[i]*.29); data[i]=data[i+1]=data[i+2]=value;
}
const texture=await sharp(data,{raw:info}).png().toBuffer();
const views=[], chunks=[], accessors=[];let offset=0;
function append(buffer,target){const padded=Buffer.alloc(Math.ceil(buffer.length/4)*4);buffer.copy(padded);chunks.push(padded);views.push({buffer:0,byteOffset:offset,byteLength:buffer.length,...(target?{target}:{})});offset+=padded.length;return views.length-1;}
function attribute(values,width,type=5126){const a=values.flat();const b=Buffer.alloc(a.length*4);a.forEach((n,i)=>b[type===5126?'writeFloatLE':'writeUInt32LE'](n,i*4));const bufferView=append(b,type===5126?34962:34963);const value={bufferView,componentType:type,count:values.length,type:width===3?'VEC3':width===2?'VEC2':'SCALAR'};if(width===3){value.min=[0,1,2].map(d=>Math.min(...values.map(p=>p[d])));value.max=[0,1,2].map(d=>Math.max(...values.map(p=>p[d])));}accessors.push(value);return accessors.length-1;}
// Cyclic axis permutation lays the stem along X. Uniform scaling retains shape.
const scale=.060, minZ=Math.min(...positions.map(p=>p[2]));
const centerX=(Math.min(...positions.map(p=>p[0]))+Math.max(...positions.map(p=>p[0])))/2;
const centerY=(Math.min(...positions.map(p=>p[1]))+Math.max(...positions.map(p=>p[1])))/2;
const transformed=positions.map(([x,y,z])=>[(y-centerY)*scale,(z-minZ)*scale,(x-centerX)*scale]);
const normals=read(primitive.attributes.NORMAL,3).map(([x,y,z])=>[y,z,x]);
const attributes={POSITION:attribute(transformed,3),NORMAL:attribute(normals,3),TEXCOORD_0:attribute(uv,2)};
const names=['bloom','leaves','stem'];
const primitives=names.map((name,material)=>{const selected=[];for(let i=0;i<indices.length;i+=3)if(kinds[indices[i]]===name)selected.push(...indices.slice(i,i+3));return {attributes,indices:attribute(selected.map(i=>[i]),1,5125),material,mode:4};});
const out={asset:{version:'2.0',generator:'ELSEWHERE rose conversion',extras:json.asset.extras},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Uploaded Rose'}],meshes:[{primitives}],materials:names.map(name=>({name,doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:name==='bloom'?.68:.85}})),textures:[{source:0,sampler:0}],samplers:json.samplers,images:[{bufferView:append(texture),mimeType:'image/png'}],accessors,bufferViews:views,buffers:[{byteLength:offset}]};
// Preserve the legacy gloss map as a PBR roughness texture (alpha -> G).
const gloss=json.bufferViews[json.images[1].bufferView];
const spec=await sharp(binary.subarray(gloss.byteOffset,gloss.byteOffset+gloss.byteLength)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let i=0;i<spec.data.length;i+=4){const roughness=Math.max(90,255-spec.data[i+3]);spec.data[i]=255;spec.data[i+1]=roughness;spec.data[i+2]=0;spec.data[i+3]=255;}
const rough=await sharp(spec.data,{raw:spec.info}).png().toBuffer();
out.images.push({bufferView:append(rough),mimeType:'image/png'});out.textures.push({source:1,sampler:0});out.buffers[0].byteLength=offset;
out.materials.forEach(m=>{m.pbrMetallicRoughness.metallicRoughnessTexture={index:1};m.pbrMetallicRoughness.roughnessFactor=1;});
const text=Buffer.from(JSON.stringify(out));const jsonChunk=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(jsonChunk);
const bin=Buffer.concat(chunks), header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonChunk.length+bin.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);
await fs.writeFile('public/models/optimized/rose-3d.glb',Buffer.concat([header,jsonChunk,bh,bin]));
console.log({triangles:indices.length/3,parts:primitives.map((p,i)=>[names[i],out.accessors[p.indices].count/3]),bytes:28+jsonChunk.length+bin.length});
