export function validateBasePath(value = "/") {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(value))
    throw new Error("VITE_BASE_PATH must be / or a path such as /repository-name/.");
  return value;
}

export function deploymentConfig(env) {
  if (env.VITE_ENABLE_COLLAB !== "true")
    throw new Error("Set VITE_ENABLE_COLLAB=true for the collaborative deployment.");
  let backend;
  try { backend = new URL(env.VITE_SOCKET_URL); }
  catch { throw new Error("Set VITE_SOCKET_URL to the deployed Render HTTPS origin."); }
  if (backend.protocol !== "https:" || backend.origin !== env.VITE_SOCKET_URL ||
    backend.hostname === "localhost" || backend.hostname.endsWith(".localhost") ||
    backend.hostname === "127.0.0.1" || backend.hostname === "[::1]" ||
    backend.hostname.endsWith(".invalid") || backend.hostname === "example.com")
    throw new Error("VITE_SOCKET_URL must be a real HTTPS backend origin, without a path or trailing slash.");
  return { backendUrl: backend.origin, base: validateBasePath(env.VITE_BASE_PATH || "/") };
}
