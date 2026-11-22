export function collaborationConfig(env = import.meta.env ?? {}) {
  return {
    enabled: env.VITE_ENABLE_COLLAB !== "false",
    url: env.VITE_SOCKET_URL || (env.DEV ? "http://localhost:3001" : ""),
  };
}
