const DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173";

function positiveInteger(value, fallback, name) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error(`${name} must be a positive integer.`);
  return number;
}

export function readConfig(env = process.env) {
  const port = positiveInteger(env.PORT, 3001, "PORT");
  if (port > 65535) throw new Error("PORT must be at most 65535.");
  const allowedOrigins = (env.CORS_ORIGINS ?? DEFAULT_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!allowedOrigins.length) throw new Error("CORS_ORIGINS must not be empty.");
  for (const origin of allowedOrigins) {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin)
      throw new Error("CORS_ORIGINS must contain exact HTTP(S) origins, without paths.");
  }
  return {
    port,
    allowedOrigins,
    contributionLimit: positiveInteger(env.CONTRIBUTION_LIMIT, 6, "CONTRIBUTION_LIMIT"),
    contributionWindowMs: positiveInteger(
      env.CONTRIBUTION_WINDOW_MS,
      60000,
      "CONTRIBUTION_WINDOW_MS",
    ),
  };
}
