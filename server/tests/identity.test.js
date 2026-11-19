import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { IDENTITY_KEY, readIdentity, roomFromUrl, saveIdentity } from "../../src/collaboration/identity.js";

test("browser identity survives storage round trips and rejects corrupt profiles", (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  assert.equal(readIdentity(), null);
  const identity = { visitorId: randomUUID(), username: "Avery", avatarType: "female" };
  assert.equal(saveIdentity(identity), true);
  assert.deepEqual(readIdentity(), identity);
  values.set(IDENTITY_KEY, JSON.stringify({ ...identity, unexpected: "ignored" }));
  assert.deepEqual(readIdentity(), identity);
  for (const bad of ["not JSON", "null", JSON.stringify({ ...identity, visitorId: "bad" })]) {
    values.set(IDENTITY_KEY, bad);
    assert.equal(readIdentity(), null);
  }
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new Error("Storage blocked"); },
  });
  assert.equal(readIdentity(), null);
  assert.equal(saveIdentity(identity), false);
});

test("room links default only when absent and reject invalid supplied IDs", () => {
  assert.deepEqual(roomFromUrl(""), { roomId: "memorial", error: "" });
  assert.deepEqual(roomFromUrl("?room=shared-memorial"), { roomId: "shared-memorial", error: "" });
  for (const query of ["?room=", "?room=bad%20room", `?room=${"a".repeat(65)}`]) {
    assert.equal(roomFromUrl(query).roomId, null);
    assert.ok(roomFromUrl(query).error);
  }
});
