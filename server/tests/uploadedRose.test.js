import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import sharp from 'sharp';

// Verify the runtime derivative against the actual upload, not generated fixtures.
test('uploaded rose retains every triangle and full texture resolution, with untouched green texels', async () => {
  const bytes=await fs.readFile('public/models/rose_3d.glb');
  const length=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+length));
  const binary=bytes.subarray(28+length), view=json.bufferViews[json.images[0].bufferView];
  const original=await sharp(binary.subarray(view.byteOffset,view.byteOffset+view.byteLength)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const model=await new NodeIO().read('public/models/optimized/rose-3d.glb');
  const parts=model.getRoot().listMeshes()[0].listPrimitives();
  assert.deepEqual(parts.map(p=>p.getMaterial().getName()),['bloom','leaves','stem']);
  assert.equal(parts.reduce((n,p)=>n+p.getIndices().getCount(),0),json.accessors[json.meshes[0].primitives[0].indices].count);
  assert.ok(parts.every(p=>p.getAttribute('POSITION').getCount()===12098));
  const converted=await sharp(parts[0].getMaterial().getBaseColorTexture().getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(converted.info.width,original.info.width);assert.equal(converted.info.height,original.info.height);
  let unchanged=0,petals=0;
  for(let i=0;i<original.data.length;i+=4){
    const red=original.data[i]>original.data[i+1]*1.6&&original.data[i]>original.data[i+2]*1.5;
    if(!red){assert.ok(original.data.subarray(i,i+4).equals(converted.data.subarray(i,i+4)));unchanged++;}
    else {assert.equal(converted.data[i],converted.data[i+1]);assert.equal(converted.data[i],converted.data[i+2]);petals++;}
  }
  assert.ok(unchanged>10000&&petals>10000);
  assert.ok(parts.every(p=>p.getMaterial().getMetallicRoughnessTexture()));
});
