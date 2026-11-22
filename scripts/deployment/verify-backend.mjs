import assert from "node:assert/strict";

export async function verifyBackend(backendUrl, frontendUrl) {
  const origin = frontendUrl ? new URL(frontendUrl).origin : undefined;
  // Allow a cold service time to start, but never publish against an absent backend.
  const response = await fetch(new URL("/health", backendUrl), {
    headers: origin ? { Origin: origin } : {}, signal: AbortSignal.timeout(90000),
  });
  assert.equal(response.status, 200, `Backend /health returned HTTP ${response.status}.`);
  if (origin)
    assert.equal(response.headers.get("access-control-allow-origin"), origin, "Backend CORS must allow the frontend origin.");
  const health = await response.json();
  assert.equal(health.status, "ok");
  assert.equal(health.service, "elsewhere-memorial", "This URL is not the ELSEWHERE backend.");
  return health;
}
