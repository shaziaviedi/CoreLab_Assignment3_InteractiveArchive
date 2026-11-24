// Convert the supplied legacy specular/gloss GLB to supported PBR, retaining every
// triangle and UV. Petal islands are identified from their original red texture.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const input = process.argv[2] ?? 'public/models/rose_3d.glb';
const bytes = await fs.readFile(input);
const jsonLength = bytes.readUInt32LE(12);
const sourceGltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const sourceBinary = bytes.subarray(28 + jsonLength);
const image = sourceGltf.bufferViews[sourceGltf.images[0].bufferView];
const {
  data,
  info
} = await sharp(sourceBinary.subarray(image.byteOffset, image.byteOffset + image.byteLength)).ensureAlpha().raw().toBuffer({
  resolveWithObject: true
});
const isPetalPixel = offset => data[offset] > data[offset + 1] * 1.6 && data[offset] > data[offset + 2] * 1.5;
function readAccessor(index, width) {
  const a = sourceGltf.accessors[index],
    v = sourceGltf.bufferViews[a.bufferView];
  return Array.from({
    length: a.count
  }, (_, i) => Array.from({
    length: width
  }, (_, c) => sourceBinary[a.componentType === 5126 ? 'readFloatLE' : 'readUInt32LE']((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? width * 4) + c * 4)));
}
const primitive = sourceGltf.meshes[0].primitives[0];
const positions = readAccessor(primitive.attributes.POSITION, 3),
  textureCoordinates = readAccessor(primitive.attributes.TEXCOORD_0, 2),
  indices = readAccessor(primitive.indices, 1).flat();
const adjacentVertices = positions.map(() => []);
for (let i = 0; i < indices.length; i += 3) {
  const [a, b, c] = indices.slice(i, i + 3);
  adjacentVertices[a].push(b, c);
  adjacentVertices[b].push(a, c);
  adjacentVertices[c].push(a, b);
}
const partByVertex = [],
  seen = new Set();
for (let i = 0; i < positions.length; i++) {
  if (seen.has(i)) continue;
  const group = [i];
  seen.add(i);
  for (let n = 0; n < group.length; n++) for (const k of adjacentVertices[group[n]]) if (!seen.has(k)) {
    seen.add(k);
    group.push(k);
  }
  const red = group.filter(k => {
    const [u, v] = textureCoordinates[k];
    return isPetalPixel((Math.min(info.height - 1, Math.floor(v * info.height)) * info.width + Math.min(info.width - 1, Math.floor(u * info.width))) * 4);
  }).length;
  const span = [0, 1, 2].map(d => Math.max(...group.map(k => positions[k][d])) - Math.min(...group.map(k => positions[k][d])));
  const kind = red > group.length / 2 ? 'bloom' : span[1] > 2 ? 'stem' : 'leaves';
  group.forEach(k => partByVertex[k] = kind);
}
// Neutralize petals only. Their luminance variation/veining survives all tints;
// green pixels (including stem, leaves and sepals) remain byte-for-byte intact.
for (let i = 0; i < data.length; i += 4) if (isPetalPixel(i)) {
  const value = Math.round(180 + data[i] * .29);
  data[i] = data[i + 1] = data[i + 2] = value;
}
const texture = await sharp(data, {
  raw: info
}).png().toBuffer();
const bufferViews = [],
  chunks = [],
  accessors = [];
let bufferOffset = 0;
function append(buffer, target) {
  const padded = Buffer.alloc(Math.ceil(buffer.length / 4) * 4);
  buffer.copy(padded);
  chunks.push(padded);
  bufferViews.push({
    buffer: 0,
    byteOffset: bufferOffset,
    byteLength: buffer.length,
    ...(target ? {
      target
    } : {})
  });
  bufferOffset += padded.length;
  return bufferViews.length - 1;
}
function attribute(values, width, type = 5126) {
  const a = values.flat();
  const b = Buffer.alloc(a.length * 4);
  a.forEach((n, i) => b[type === 5126 ? 'writeFloatLE' : 'writeUInt32LE'](n, i * 4));
  const bufferView = append(b, type === 5126 ? 34962 : 34963);
  const value = {
    bufferView,
    componentType: type,
    count: values.length,
    type: width === 3 ? 'VEC3' : width === 2 ? 'VEC2' : 'SCALAR'
  };
  if (width === 3) {
    value.min = [0, 1, 2].map(d => Math.min(...values.map(p => p[d])));
    value.max = [0, 1, 2].map(d => Math.max(...values.map(p => p[d])));
  }
  accessors.push(value);
  return accessors.length - 1;
}
// Cyclic axis permutation lays the stem along X. Uniform scaling retains shape.
const scale = .060,
  minZ = Math.min(...positions.map(p => p[2]));
const centerX = (Math.min(...positions.map(p => p[0])) + Math.max(...positions.map(p => p[0]))) / 2;
const centerY = (Math.min(...positions.map(p => p[1])) + Math.max(...positions.map(p => p[1]))) / 2;
const restingPositions = positions.map(([x, y, z]) => [(y - centerY) * scale, (z - minZ) * scale, (x - centerX) * scale]);
const normals = readAccessor(primitive.attributes.NORMAL, 3).map(([x, y, z]) => [y, z, x]);
const attributes = {
  POSITION: attribute(restingPositions, 3),
  NORMAL: attribute(normals, 3),
  TEXCOORD_0: attribute(textureCoordinates, 2)
};
const partNames = ['bloom', 'leaves', 'stem'];
const primitives = partNames.map((name, material) => {
  const selected = [];
  for (let i = 0; i < indices.length; i += 3) if (partByVertex[indices[i]] === name) selected.push(...indices.slice(i, i + 3));
  return {
    attributes,
    indices: attribute(selected.map(i => [i]), 1, 5125),
    material,
    mode: 4
  };
});
const runtimeGltf = {
  asset: {
    version: '2.0',
    generator: 'ELSEWHERE rose conversion',
    extras: sourceGltf.asset.extras
  },
  scene: 0,
  scenes: [{
    nodes: [0]
  }],
  nodes: [{
    mesh: 0,
    name: 'Uploaded Rose'
  }],
  meshes: [{
    primitives
  }],
  materials: partNames.map(name => ({
    name,
    doubleSided: true,
    pbrMetallicRoughness: {
      baseColorTexture: {
        index: 0
      },
      metallicFactor: 0,
      roughnessFactor: name === 'bloom' ? .68 : .85
    }
  })),
  textures: [{
    source: 0,
    sampler: 0
  }],
  samplers: sourceGltf.samplers,
  images: [{
    bufferView: append(texture),
    mimeType: 'image/png'
  }],
  accessors,
  bufferViews: bufferViews,
  buffers: [{
    byteLength: bufferOffset
  }]
};
// Preserve the legacy gloss map as a PBR roughness texture (alpha -> G).
const gloss = sourceGltf.bufferViews[sourceGltf.images[1].bufferView];
const specularImage = await sharp(sourceBinary.subarray(gloss.byteOffset, gloss.byteOffset + gloss.byteLength)).ensureAlpha().raw().toBuffer({
  resolveWithObject: true
});
for (let i = 0; i < specularImage.data.length; i += 4) {
  const roughness = Math.max(90, 255 - specularImage.data[i + 3]);
  specularImage.data[i] = 255;
  specularImage.data[i + 1] = roughness;
  specularImage.data[i + 2] = 0;
  specularImage.data[i + 3] = 255;
}
const roughnessTexture = await sharp(specularImage.data, {
  raw: specularImage.info
}).png().toBuffer();
runtimeGltf.images.push({
  bufferView: append(roughnessTexture),
  mimeType: 'image/png'
});
runtimeGltf.textures.push({
  source: 1,
  sampler: 0
});
runtimeGltf.buffers[0].byteLength = bufferOffset;
runtimeGltf.materials.forEach(m => {
  m.pbrMetallicRoughness.metallicRoughnessTexture = {
    index: 1
  };
  m.pbrMetallicRoughness.roughnessFactor = 1;
});
const jsonBytes = Buffer.from(JSON.stringify(runtimeGltf));
const jsonChunk = Buffer.alloc(Math.ceil(jsonBytes.length / 4) * 4, 32);
jsonBytes.copy(jsonChunk);
const binaryChunk = Buffer.concat(chunks),
  header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonChunk.length + binaryChunk.length, 8);
header.writeUInt32LE(jsonChunk.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(binaryChunk.length, 0);
binaryHeader.writeUInt32LE(0x004e4942, 4);
await fs.writeFile('public/models/optimized/rose-3d.glb', Buffer.concat([header, jsonChunk, binaryHeader, binaryChunk]));
console.log({
  triangles: indices.length / 3,
  parts: primitives.map((p, i) => [partNames[i], runtimeGltf.accessors[p.indices].count / 3]),
  bytes: 28 + jsonChunk.length + binaryChunk.length
});
