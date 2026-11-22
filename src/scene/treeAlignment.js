import { Box3, Vector3 } from "three";

// Canopy bounds are asymmetric. Center the installation on the visible lower
// trunk instead, accounting for the GLB's mesh/node transforms before scaling.
export function treeTrunkCenter(scene) {
  scene.updateWorldMatrix(true, true);
  const overall = new Box3().setFromObject(scene);
  const base = new Box3(), point = new Vector3();
  scene.traverse((node) => {
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!node.isMesh || !materials.some((material) => /bark/i.test(material?.name ?? ""))) return;
    const positions = node.geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld);
      if (point.y <= overall.min.y + (overall.max.y - overall.min.y) * 0.08) base.expandByPoint(point);
    }
  });
  return (base.isEmpty() ? overall : base).getCenter(new Vector3());
}
