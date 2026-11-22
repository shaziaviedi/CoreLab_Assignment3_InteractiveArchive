import { readFileSync } from "node:fs";
import * as THREE from "three";
import { NORTH_POOL, POOL_SCALE } from "../../../src/scene/memorialLayout.js";

// Decode only mesh positions and indices; the real GLB supplies all test geometry.
export function loadGeometry(relativePath) {
  const bytes = readFileSync(new URL(relativePath, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength + 8;
  const types = { 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  function attribute(index) {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    const width = accessor.type === "VEC3" ? 3 : 1;
    const Type = types[accessor.componentType];
    const start = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = new Type(accessor.count * width);
    const stride = view.byteStride ?? width * Type.BYTES_PER_ELEMENT;
    const read = accessor.componentType === 5126 ? "readFloatLE" :
      accessor.componentType === 5125 ? "readUInt32LE" : "readUInt16LE";
    for (let vertex = 0; vertex < accessor.count; vertex++)
      for (let component = 0; component < width; component++)
        values[vertex * width + component] = bytes[read](start + vertex * stride + component * Type.BYTES_PER_ELEMENT);
    return new THREE.BufferAttribute(values, width);
  }
  function node(index) {
    const source = gltf.nodes[index];
    const group = new THREE.Group();
    if (source.matrix) group.applyMatrix4(new THREE.Matrix4().fromArray(source.matrix));
    else {
      group.position.fromArray(source.translation ?? [0, 0, 0]);
      group.quaternion.fromArray(source.rotation ?? [0, 0, 0, 1]);
      group.scale.fromArray(source.scale ?? [1, 1, 1]);
    }
    if (source.mesh !== undefined) {
      for (const primitive of gltf.meshes[source.mesh].primitives) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", attribute(primitive.attributes.POSITION));
        if (primitive.indices !== undefined) geometry.setIndex(attribute(primitive.indices));
        const material = new THREE.MeshBasicMaterial();
        material.name = gltf.materials?.[primitive.material]?.name ?? "";
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = source.name;
        group.add(mesh);
      }
    }
    (source.children ?? []).forEach((child) => group.add(node(child)));
    return group;
  }
  const root = new THREE.Group();
  gltf.scenes[gltf.scene ?? 0].nodes.forEach((index) => root.add(node(index)));
  return root;
}


export function loadPoolGeometry() {
  const root = loadGeometry("../../../public/models/reference-pool.glb");
  root.position.fromArray(NORTH_POOL);
  root.scale.setScalar(POOL_SCALE);
  return root;
}
