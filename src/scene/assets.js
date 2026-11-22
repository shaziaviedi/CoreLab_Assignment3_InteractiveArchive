import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer/decoder";
import { ESSENTIAL_MODELS } from "./assetManifest.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const models = new Map();
export const modelUrl = (name) => `${(import.meta.env?.BASE_URL ?? "/")}models/optimized/${name}.glb`;
export const essentialModels = ESSENTIAL_MODELS;

function resource(name) {
  const url = modelUrl(name);
  if (!models.has(url)) {
    const entry = { status: "pending", value: null, promise: null };
    entry.promise = loader.loadAsync(url).then((value) => {
      entry.status = "ready";
      entry.value = value;
    }, (error) => {
      entry.status = "error";
      entry.value = error;
    });
    models.set(url, entry);
  }
  return models.get(url);
}

// One promise per URL, shared by preload, single-model and grouped consumers.
export function useModels(names) {
  const entries = names.map(resource);
  for (const entry of entries) {
    if (entry.status === "pending") throw entry.promise;
    if (entry.status === "error") throw entry.value;
  }
  return entries.map((entry) => entry.value);
}

export function useModel(name) {
  return useModels([name])[0];
}

export async function prepareSceneAssets() {
  performance.mark("elsewhere:assets-start");
  for (const batch of [essentialModels.slice(0, 2), essentialModels.slice(2, 6), essentialModels.slice(6)]) {
    await Promise.all(batch.map((name) => resource(name).promise));
    const failed = batch.map(resource).find((entry) => entry.status === "error");
    if (failed) throw failed.value;
  }
  performance.mark("elsewhere:assets-ready");
  performance.measure("elsewhere:asset-loading", "elsewhere:assets-start", "elsewhere:assets-ready");
}
