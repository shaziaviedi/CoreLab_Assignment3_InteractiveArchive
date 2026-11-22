import { mkdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

const names = [
  "reference-pool", "reference-museum", "survivor-sakura", "jabami-bush",
  "jabami-tree-v1", "jabami-tree-v4", "oculus", "city-lowpoly", "city-newyork",
  "one-world-trade-center", "male-idle", "female-idle", "male-walk", "female-walk",
];
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder,
});
await mkdir("public/models/optimized", { recursive: true });
await mkdir("docs", { recursive: true });

function geometrySignature(document) {
  const root = document.getRoot();
  const indices = new Set(root.listMeshes().flatMap((mesh) =>
    mesh.listPrimitives().map((primitive) => primitive.getIndices())));
  const accessors = root.listAccessors().map((accessor) => {
    const array = accessor.getArray().slice();
    // Meshopt may cyclically rotate triangle indices without changing winding.
    if (indices.has(accessor)) for (let i = 0; i < array.length; i += 3) {
      const face = [array[i], array[i + 1], array[i + 2]];
      const first = face.indexOf(Math.min(...face));
      for (let j = 0; j < 3; j++) array[i + j] = face[(first + j) % 3];
    }
    return createHash("sha256").update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest("hex");
  }).sort();
  return JSON.stringify({
    accessors,
    nodes: root.listNodes().map((node) => [node.getName(), node.getTranslation(), node.getRotation(), node.getScale()]),
    animations: root.listAnimations().map((animation) => [animation.getName(), animation.listChannels().length]),
    materials: root.listMaterials().map((material) => material.getName()),
  });
}

const report = [];
for (const name of names) {
  const source = `public/models/${name}.glb`;
  const output = `public/models/optimized/${name}.glb`;
  const document = await io.read(source);
  const signature = geometrySignature(document);
  // These renderers already discard color maps. Keep all other material maps.
  if (["reference-pool", "reference-museum", "oculus"].includes(name)) {
    document.getRoot().listMaterials().forEach((material) => material.setBaseColorTexture(null));
    await document.transform(prune({ propertyTypes: [PropertyType.TEXTURE], keepSolidTextures: true }));
  }
  // No resizing, quantization, simplification, vertex reordering or animation edits.
  await document.transform(textureCompress({
    encoder: sharp, targetFormat: "webp", formats: /png/,
    slots: /^(baseColorTexture|emissiveTexture)$/, lossless: true,
  }));
  document.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(output, document);
  const decoded = await io.read(output);
  if (geometrySignature(decoded) !== signature)
    throw new Error(`Geometry, transforms or animation data changed in ${name}.`);
  const row = { name, before: (await stat(source)).size, after: (await stat(output)).size };
  report.push(row);
  console.log(`${name}: ${row.before} → ${row.after} bytes`);
}
await writeFile("docs/asset-optimization.json", JSON.stringify({
  method: "Lossless Meshopt; full-resolution lossless WebP for color PNGs; unused runtime-discarded color maps removed",
  originals: "Original GLBs remain unchanged in public/models; runtime loads only public/models/optimized",
  assets: report,
  before: report.reduce((sum, row) => sum + row.before, 0),
  after: report.reduce((sum, row) => sum + row.after, 0),
}, null, 2) + "\n");
