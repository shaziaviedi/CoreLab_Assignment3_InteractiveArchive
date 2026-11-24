import { ROSE_PALETTE } from "./roseAppearance.js";

// Geometry and texture maps belong to the shared GLTF cache. Only materials are
// cloned; all flowers and previews reuse these three meshes and five palettes.
export function createRoseResources(scene) {
  const geometries = {},
    materials = {},
    preview = {};
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const name = mesh.material.name;
    geometries[name] = mesh.geometry;
    materials[name] = mesh.material.clone();
    preview[name] = mesh.material.clone();
    preview[name].transparent = true;
    preview[name].opacity = 0.42;
    preview[name].depthWrite = false;
  });
  if (!geometries.bloom || !geometries.stem || !geometries.leaves) throw new Error("The uploaded rose is missing its petal or foliage geometry.");
  const variants = Object.fromEntries(Object.entries(ROSE_PALETTE).map(([key, appearance]) => {
    const bloom = materials.bloom.clone();
    bloom.color.set(appearance.color);
    const ghost = preview.bloom.clone();
    ghost.color.set(appearance.color);
    return [key, {
      materials: {
        ...materials,
        bloom
      },
      preview: {
        ...preview,
        bloom: ghost
      }
    }];
  }));
  return {
    geometries,
    materials,
    preview,
    variants,
    dispose() {
      const unique = new Set([...Object.values(materials), ...Object.values(preview), ...Object.values(variants).flatMap(variant => [...Object.values(variant.materials), ...Object.values(variant.preview)])]);
      unique.forEach(material => material.dispose());
    }
  };
}
