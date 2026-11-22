import {
  BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, DoubleSide,
  CatmullRomCurve3, TubeGeometry, Vector3, SphereGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// One fixed, lightweight white rose. X follows the parapet; Y is its surface normal.
// Every rose reuses these geometries/materials, with three mesh draws per rose.
function petal(angle, radius, height, base) {
  const positions = [], colors = [], indices = [];
  const columns = 6, rows = 8;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns * 2 - 1;
      const theta = angle + u * 0.65 * Math.sin(v * Math.PI / 2);
      const r = 0.003 + radius * v;
      const y = base + height * Math.sin(v * Math.PI * 0.65) - 0.012 * v ** 4 * (1 - u * u) + u * u * 0.009 * v;
      positions.push(0.16 + Math.cos(theta) * r, y, Math.sin(theta) * r);
      const vein = Math.cos(u * 35 + v * 4) * 0.007;
      colors.push(0.95 + v * 0.04 + vein, 0.9 + v * 0.08 + vein, 0.79 + v * 0.15 + vein);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function leaf(origin, direction, length, width) {
  const positions = [], indices = [];
  for (let row = 0; row <= 8; row++) {
    const v = row / 8;
    const halfWidth = Math.sin(Math.PI * v) * width;
    for (let column = 0; column < 3; column++) {
      const u = column - 1;
      positions.push(origin[0] + v * length * direction[0] + u * halfWidth * direction[1],
        origin[1] + Math.sin(v * Math.PI) * 0.012 - Math.abs(u) * halfWidth * 0.2,
        origin[2] + v * length * direction[1] - u * halfWidth * direction[0]);
      if (row < 8 && column < 2) {
        const a = row * 3 + column;
        indices.push(a, a + 3, a + 1, a + 3, a + 4, a + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createRoseResources() {
  const petals = [];
  [[8, 0.064, 0.044, 0.019], [7, 0.049, 0.055, 0.025], [6, 0.033, 0.067, 0.03], [5, 0.018, 0.07, 0.033]]
    .forEach(([count, radius, height, base], layer) => {
      for (let i = 0; i < count; i++) petals.push(petal(i * Math.PI * 2 / count + layer * 1.7, radius, height, base));
    });
  const center = new SphereGeometry(0.011, 8, 6).scale(1, 1.4, 1).translate(0.16, 0.083, 0);
  center.deleteAttribute("uv");
  center.setAttribute("color", new Float32BufferAttribute(Array.from({ length: center.attributes.position.count }, () => [0.98, 0.93, 0.83]).flat(), 3));
  petals.push(center);
  const bloom = mergeGeometries(petals);
  petals.forEach((geometry) => geometry.dispose());
  const foliage = [
    leaf([-0.12, 0.014, 0], [0.8, 0.6], 0.1, 0.02),
    leaf([-0.04, 0.014, 0], [-0.65, -0.76], 0.1, 0.021),
    ...Array.from({ length: 5 }, (_, index) => {
      const angle = index * Math.PI * 2 / 5;
      return leaf([0.16, 0.018, 0], [Math.cos(angle), Math.sin(angle)], 0.05, 0.008);
    }),
  ];
  const leaves = mergeGeometries(foliage);
  foliage.forEach((geometry) => geometry.dispose());
  const stem = new TubeGeometry(new CatmullRomCurve3([
    new Vector3(-0.25, 0.004, 0), new Vector3(-0.13, 0.008, -0.008),
    new Vector3(0.04, 0.009, 0.005), new Vector3(0.16, 0.023, 0),
  ]), 16, 0.003, 6, false);
  // About 38 cm long with a 10 cm bloom, fitted to the model's narrow outer lip.
  [bloom, leaves, stem].forEach((geometry) => geometry.scale(0.8, 0.8, 0.8));
  const materials = {
    bloom: new MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: DoubleSide }),
    leaves: new MeshStandardMaterial({ color: "#48643b", roughness: 0.82, side: DoubleSide }),
    stem: new MeshStandardMaterial({ color: "#526b3e", roughness: 0.85 }),
  };
  const preview = Object.fromEntries(Object.entries(materials).map(([key, material]) => {
    const copy = material.clone();
    copy.transparent = true;
    copy.opacity = 0.42;
    copy.depthWrite = false;
    return [key, copy];
  }));
  return {
    geometries: { bloom, leaves, stem }, materials, preview,
    dispose() {
      Object.values(this.geometries).forEach((geometry) => geometry.dispose());
      [...Object.values(materials), ...Object.values(preview)].forEach((material) => material.dispose());
    },
  };
}
