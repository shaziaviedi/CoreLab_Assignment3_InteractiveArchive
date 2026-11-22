import { io } from "socket.io-client";
import { collaborationConfig } from "./config.js";

export function createMemorialSocket() {
  const { enabled, url } = collaborationConfig();
  if (!enabled) return null;
  if (!url) throw new Error("Set VITE_SOCKET_URL to connect to the memorial server.");
  const parsed = validateSocketUrl(url, Boolean(import.meta.env?.PROD));
  return io(parsed.origin, {
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 8000,
  });
}

export function validateSocketUrl(url, production = false) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("VITE_SOCKET_URL must be an HTTP or HTTPS URL.");
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash)
    throw new Error("VITE_SOCKET_URL must be the backend origin, without credentials, a path or query.");
  if (production && (parsed.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.hostname.endsWith(".localhost")))
    throw new Error("The published memorial needs a public HTTPS backend. Update VITE_SOCKET_URL and rebuild the frontend.");
  return parsed;
}
