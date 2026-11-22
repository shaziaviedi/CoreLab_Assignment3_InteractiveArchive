import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

// Watch source content only: file-provider hydration and dependency reads must
// not repeatedly restart the server and clear its in-memory room state.
const hashes = new Map(), watchers = [], changed = new Set();
let child, timer, closing = false, restarting = false;
async function digest(path) {
  try { return createHash("sha256").update(await readFile(path)).digest("hex"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
async function remember(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await remember(path);
    else if (path.endsWith(".js") && !path.includes(`${join("server", "tests")}`)) hashes.set(path, await digest(path));
  }
}
function start() {
  child = spawn(process.execPath, ["server/index.js"], { stdio: "inherit", env: process.env });
  child.on("error", (error) => console.error(error.message));
  child.on("exit", (code) => {
    if (!closing && !restarting && code) console.error("Backend stopped. Correct the error and save a server file to retry.");
  });
}
async function restart() {
  if (closing || restarting) return;
  const paths = [...changed];
  changed.clear();
  let edited = false;
  for (const path of paths) {
    const next = await digest(path);
    if (hashes.get(path) !== next) { hashes.set(path, next); edited = true; }
  }
  if (!edited || closing) return;
  restarting = true;
  console.log("Server source changed; restarting the memorial backend.");
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await exited;
  }
  restarting = false;
  if (!closing) start();
  if (changed.size) timer = setTimeout(() => restart().catch(console.error), 250);
}
for (const directory of ["server", "shared"]) {
  await remember(directory);
  watchers.push(watch(directory, { recursive: true }, (_event, file) => {
    if (!file?.endsWith(".js") || file.split(/[\\/]/)[0] === "tests") return;
    changed.add(join(directory, file));
    clearTimeout(timer);
    timer = setTimeout(() => restart().catch(console.error), 250);
  }));
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  closing = true;
  clearTimeout(timer);
  watchers.forEach((watcher) => watcher.close());
  child?.kill("SIGTERM");
});
start();
