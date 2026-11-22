import { build, loadEnv } from "vite";
import { deploymentConfig } from "./config.mjs";
import { verifyBackend } from "./verify-backend.mjs";

// Vercel serves this frontend at its root. The persistent Socket.io service is
// external, and its public HTTPS origin must exist at Vite build time.
try {
  const env = loadEnv("production", process.cwd(), "VITE_");
  const config = deploymentConfig({ ...env, VITE_ENABLE_COLLAB: env.VITE_ENABLE_COLLAB ?? "true", VITE_BASE_PATH: "/" });
  await verifyBackend(config.backendUrl, process.env.FRONTEND_URL);
  await build({ base: config.base });
} catch (error) {
  console.error(`Vercel build stopped: ${error.message}`);
  process.exitCode = 1;
}
