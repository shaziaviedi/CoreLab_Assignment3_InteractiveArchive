import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";
import { PUBLIC_ASSETS } from "../../src/scene/assetManifest.js";
import { validateBasePath } from "./config.mjs";

export async function verifyBuild(directory, env) {
  const base = validateBasePath(env.VITE_BASE_PATH || "/");
  const html = await readFile(resolve(directory, "index.html"), "utf8");
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^https?:/.test(reference)) continue;
    assert.ok(reference.startsWith(base), `HTML asset must use the Pages base: ${reference}`);
    assert.ok(!reference.includes(".."), "Asset paths must stay inside the build.");
    await readFile(resolve(directory, reference.slice(base.length)));
  }
  for (const asset of PUBLIC_ASSETS) {
    const bytes = await readFile(resolve(directory, asset));
    if (asset.endsWith(".glb")) {
      assert.equal(bytes.toString("ascii", 0, 4), "glTF", `${asset} is not a GLB`);
      assert.equal(bytes.readUInt32LE(8), bytes.length, `${asset} is incomplete`);
      const json = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
      for (const item of [...(json.images ?? []), ...(json.buffers ?? [])])
        assert.ok(!item.uri || item.uri.startsWith("data:"), `${asset} has an unresolved external resource`);
    } else assert.match(bytes.toString(), /<svg[\s>]/, `${asset} is not SVG`);
  }
  if (env.VITE_ENABLE_COLLAB === "true") {
    assert.ok(env.VITE_SOCKET_URL, "A collaborative build needs VITE_SOCKET_URL.");
    const chunks = await readdir(resolve(directory, "assets"));
    const scripts = await Promise.all(chunks.filter((name) => name.endsWith(".js"))
      .map((name) => readFile(resolve(directory, "assets", name), "utf8")));
    assert.ok(scripts.some((script) => script.includes(env.VITE_SOCKET_URL)), "Build does not contain the configured backend URL.");
  }
  return { base, publicAssets: PUBLIC_ASSETS.length };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await verifyBuild(resolve("dist"), loadEnv("production", process.cwd(), "VITE_"));
    console.log(`Build verified: ${result.publicAssets} public assets under ${result.base}`);
  } catch (error) {
    console.error(`Build verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
