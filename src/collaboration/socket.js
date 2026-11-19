import { io } from "socket.io-client";

export function createMemorialSocket() {
  const url = import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.DEV ? "http://localhost:3001" : "");
  if (!url) throw new Error("Set VITE_SOCKET_URL to connect to the memorial server.");
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("VITE_SOCKET_URL must be an HTTP or HTTPS URL.");
  return io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 8000,
  });
}
