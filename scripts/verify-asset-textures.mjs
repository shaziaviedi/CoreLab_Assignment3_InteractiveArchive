import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

// Compare material slots, including alpha, after decoding both image formats.
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const report = JSON.parse(await readFile("docs/asset-optimization.json", "utf8"));
const slots = ["BaseColor", "Emissive", "Normal", "Occlusion", "MetallicRoughness"];
let verified = 0;
for (const { name } of report.assets) {
  const original = await io.read(`public/models/${name}.glb`);
  const optimized = await io.read(`public/models/optimized/${name}.glb`);
  const sources = original.getRoot().listMaterials();
  const checked = new Set();
  for (const [index, material] of optimized.getRoot().listMaterials().entries()) {
    for (const slot of slots) {
      const texture = material[`get${slot}Texture`]();
      if (!texture || checked.has(texture)) continue;
      checked.add(texture);
      const source = sources[index][`get${slot}Texture`]();
      assert.ok(source, `Missing source for ${name}: ${slot}`);
      const before = await sharp(source.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const after = await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(after.info.width, before.info.width, `${name}: width`);
      assert.equal(after.info.height, before.info.height, `${name}: height`);
      for (let pixel = 0; pixel < before.data.length; pixel += 4) {
        assert.equal(after.data[pixel + 3], before.data[pixel + 3], `${name}: alpha`);
        // RGB beneath completely transparent pixels has no visible contribution.
        if (before.data[pixel + 3])
          assert.ok(before.data.subarray(pixel, pixel + 3).equals(after.data.subarray(pixel, pixel + 3)), `${name}: color`);
      }
      verified++;
    }
  }
}
console.log(`Verified full-resolution color and alpha for ${verified} retained textures.`);
