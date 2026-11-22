import { loadEnv } from "vite";
import { deploymentConfig } from "./config.mjs";
import { verifyBackend } from "./verify-backend.mjs";

try {
  const config = deploymentConfig(loadEnv("production", process.cwd(), "VITE_"));
  await verifyBackend(config.backendUrl, process.env.FRONTEND_URL);
  console.log(`Deployment configuration and backend health verified: base=${config.base}, backend=${config.backendUrl}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
