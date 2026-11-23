import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { LAYOUT_VERSION } from "../shared/memorialLayout.js";

// Start one backend, or reuse a compatible one. Never kill a process we do not own.
const env = { ...process.env };
env.PORT ||= "3001";
env.VITE_ENABLE_COLLAB ||= "true";
env.VITE_SOCKET_URL ||= `http://localhost:${env.PORT}`;
const children = new Set();
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop());
function run(args) {
  const child = spawn(process.execPath, args, { env, stdio: "inherit" });
  children.add(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { children.delete(child); if (!closing) stop(code ?? 1); });
  return child;
}
async function health(url) {
  try {
    const response = await fetch(new URL("/health", url), { signal: AbortSignal.timeout(1200) });
    if (!response.ok) throw new Error(`Backend /health returned ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error.cause?.code === "ECONNREFUSED" || error.name === "TimeoutError") return null;
    throw error;
  }
}
function compatible(state) {
  if (state.service !== "elsewhere-memorial" || state.layoutVersion !== LAYOUT_VERSION)
    throw new Error("An older or different server is already using the backend port. Stop that server, then run npm run dev again.");
}
try {
  const endpoint = new URL(env.VITE_SOCKET_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
  if (env.VITE_ENABLE_COLLAB !== "false" && local) {
    if (Number(endpoint.port || (endpoint.protocol === "https:" ? 443 : 80)) !== Number(env.PORT))
      throw new Error("PORT and the port in VITE_SOCKET_URL must match for local development.");
    const existing = await health(endpoint);
    if (existing) {
      compatible(existing);
      console.log(`Reusing memorial backend at ${endpoint.origin}`);
    } else {
      console.log(`Starting memorial backend at ${endpoint.origin}…`);
      const server = run(["scripts/watch-server.mjs"]);
      const deadline = Date.now() + 120000;
      let state;
      while (!closing && !state && Date.now() < deadline) {
        await delay(250);
        state = await health(endpoint);
        if (server.exitCode !== null) throw new Error("Backend startup failed.");
      }
      if (closing) process.exitCode ||= 1;
      else if (!state) throw new Error(
        "Backend did not become ready within 120 seconds. Check the server output above." +
        (process.platform === "darwin"
          ? " If there is no server error, files may be offloaded by cloud storage. In Finder, choose Keep Downloaded for the project folder and wait for downloading to finish, then retry."
          : ""),
      );
      else compatible(state);
    }
  } else if (env.VITE_ENABLE_COLLAB !== "false") console.log(`Using external memorial backend: ${endpoint.origin}`);
  if (!closing) run(["node_modules/vite/bin/vite.js", ...process.argv.slice(2)]);
} catch (error) {
  console.error(error.message);
  stop(1);
}
