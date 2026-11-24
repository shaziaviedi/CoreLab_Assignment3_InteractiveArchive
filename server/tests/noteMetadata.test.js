import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { noteReadingFrame, projectNoteBounds, noteMetadataPosition } from '../../src/collaboration/tree/treeInteraction.js';
test('projected reading paper and contributor metadata never intersect across viewport sizes and fence sides', () => {
  for (const [width, height] of [[1440, 900], [1024, 768], [800, 600], [390, 844], [375, 667], [320, 568], [844, 390], [568, 320], [375, 500]]) {
    for (let column = 0; column < 96; column += 8) {
      const note = {
        fencePosition: {
          column,
          row: 12
        }
      };
      const camera = new PerspectiveCamera(32, width / height, .01, 280);
      const frame = noteReadingFrame(note, undefined, undefined, width / height, height);
      camera.position.copy(frame.position);
      camera.lookAt(frame.target);
      camera.updateProjectionMatrix();
      const bounds = projectNoteBounds(note, camera, width, height);
      assert.ok(bounds);
      const card = noteMetadataPosition(bounds, width, height);
      assert.ok(card.x >= 0 && card.x + 220 <= width && card.y >= 0 && card.y + 64 <= height - 80);
      assert.ok(card.x >= bounds.right + 10 || card.x + 220 <= bounds.left - 10 || card.y >= bounds.bottom + 10 || card.y + 64 <= bounds.top - 10, `${width}x${height}: clear of paper`);
    }
  }
});
