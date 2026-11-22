import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { validateBasePath } from "./scripts/deployment/config.mjs";

const workspaceKey = createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    // Local development stays at /. Pages supplies its repository path at build time.
    base: validateBasePath(env.VITE_BASE_PATH || "/"),
    plugins: [react()],
    // Keep generated dependency caches outside file-provider-managed project files.
    cacheDir: resolve(tmpdir(), "elsewhere-vite", workspaceKey, mode),
    server: { port: 5173, strictPort: true },
    optimizeDeps: {
      entries: ["index.html"],
      include: [
        "react", "react-dom/client", "three", "@react-three/fiber",
        "@react-three/postprocessing", "socket.io-client", "meshoptimizer/decoder",
      ],
    },
  };
});
