import { io } from "socket.io-client";
import { collaborationConfig } from "./config.js";

export function createMemorialSocket() {
  const { enabled, url } = collaborationConfig();
  if (!enabled) return null;
  if (!url) throw new Error("Set VITE_SOCKET_URL to connect to the memorial server.");
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("VITE_SOCKET_URL must be an HTTP or HTTPS URL.");
  return io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 8000,
  });
}
