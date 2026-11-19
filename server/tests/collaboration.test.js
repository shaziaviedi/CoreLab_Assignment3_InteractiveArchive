import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { io as connect } from "socket.io-client";
import { createMemorialServer } from "../app.js";
import { readConfig } from "../config.js";
import { ContributionRepository } from "../storage/contributionRepository.js";
import { PlacementService } from "../services/placementService.js";

async function fixture(t, overrides = {}) {
  const config = { ...readConfig({}), ...overrides };
  const server = createMemorialServer(config);
  server.httpServer.listen(0, "127.0.0.1");
  await once(server.httpServer, "listening");
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  const clients = [];
  t.after(async () => {
    clients.forEach((client) => client.disconnect());
    await new Promise((resolve) => server.io.close(resolve));
  });
  const client = async (options = {}) => {
    const socket = connect(url, {
      forceNew: true,
      reconnection: false,
      timeout: 1500,
      autoConnect: false,
      ...options,
    });
    clients.push(socket);
    const connected = once(socket, "connect");
    socket.connect();
    await connected;
    return socket;
  };
  return { ...server, url, client };
}

const emit = (socket, event, payload) => socket.timeout(2000).emitWithAck(event, payload);
const join = (socket, roomId = "memorial", username = "Visitor") =>
  emit(socket, "room:join", { roomId, username, avatarType: "female" });
const flower = (requestId = "flower-1", anchorId = "north-pool-north-01") => ({
  requestId,
  poolSide: "north",
  anchorId,
});
const note = (requestId = "note-1", anchorId = "tree-01") => ({
  requestId,
  anchorId,
  text: "Remembered together.",
});

test("health endpoint and configured origins", async (t) => {
  const { url } = await fixture(t, { allowedOrigins: ["https://elsewhere.github.io"] });
  const response = await fetch(`${url}/health`, { headers: { Origin: "https://elsewhere.github.io" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://elsewhere.github.io");
  assert.equal((await response.json()).status, "ok");
  const denied = await fetch(`${url}/health`, { headers: { Origin: "https://other.example" } });
  assert.equal(denied.status, 403);
  const preflight = await fetch(`${url}/health`, {
    method: "OPTIONS", headers: { Origin: "https://elsewhere.github.io" },
  });
  assert.equal(preflight.status, 204);
});

test("Socket.io checks origins for polling and WebSocket connections", async (t) => {
  const { url, client } = await fixture(t);
  for (const transport of ["polling", "websocket"]) {
    const allowed = await client({ transports: [transport], extraHeaders: { Origin: "http://localhost:5173" } });
    assert.equal((await join(allowed)).ok, true);
    const denied = connect(url, {
      transports: [transport], reconnection: false, autoConnect: false,
      extraHeaders: { Origin: "https://other.example" },
    });
    const rejected = once(denied, "connect_error");
    denied.connect();
    await rejected;
    assert.equal(denied.connected, false);
    denied.disconnect();
  }
});

test("joining sends the room snapshot and broadcasts presence", async (t) => {
  const { client } = await fixture(t);
  const a = await client();
  const stateEvent = once(a, "room:state");
  const first = await join(a, "memorial", "A");
  assert.equal(first.ok, true);
  assert.deepEqual((await stateEvent)[0], first.state);
  assert.equal(first.state.layoutVersion, 1);
  assert.equal(first.visitor.socketId, a.id);
  assert.match(first.visitor.visitorId, /^[0-9a-f-]{36}$/);
  assert.equal(first.visitor.joinedAt, new Date(first.visitor.joinedAt).toISOString());
  const b = await client();
  const presenceEvent = once(a, "presence:update");
  const second = await join(b, "memorial", "B");
  assert.equal(second.state.visitors.length, 2);
  assert.equal((await presenceEvent)[0].visitor.username, "B");
  const update = once(a, "presence:update");
  assert.equal((await emit(b, "presence:update", { currentZone: "tree" })).ok, true);
  assert.equal((await update)[0].visitor.currentZone, "tree");
});

test("contributions reach sender and room peers, but never another room", async (t) => {
  const { client } = await fixture(t);
  const [a, b, outsider] = await Promise.all([client(), client(), client()]);
  await join(a, "shared", "Ada");
  await join(b, "shared", "Bea");
  await join(outsider, "other");
  const leaks = [];
  outsider.on("note:created", (event) => leaks.push(event));
  outsider.on("flower:created", (event) => leaks.push(event));
  for (const [kind, payload] of [["note", note()], ["flower", flower()]]) {
    const received = once(b, `${kind}:created`);
    const echoed = once(a, `${kind}:created`);
    const result = await emit(a, `${kind}:create`, payload);
    assert.equal(result.ok, true);
    assert.equal(result.record.authorName, "Ada");
    assert.equal(result.record.authorAvatar, "female");
    assert.equal(result.record.createdAt, new Date(result.record.createdAt).toISOString());
    assert.equal((await received)[0][kind].id, result.record.id);
    assert.equal((await echoed)[0][kind].id, result.record.id);
    if (kind === "flower")
      assert.deepEqual(Object.keys(result.record).sort(), [
        "id", "roomId", "authorId", "authorName", "authorAvatar", "poolSide", "anchorId", "createdAt",
      ].sort());
  }
  const newcomer = await client();
  const state = (await join(newcomer, "shared")).state;
  assert.equal(state.notes.length, 1);
  assert.equal(state.flowers.length, 1);
  assert.equal(state.revision, 2);
  assert.equal((await join(outsider, "other")).state.flowers.length, 0);
  assert.deepEqual(leaks, []);
});

test("simultaneous placements accept one visitor and let the other retry elsewhere", async (t) => {
  const { client } = await fixture(t);
  const [a, b] = await Promise.all([client(), client()]);
  await join(a);
  await join(b);
  for (const [kind, payload, alternate] of [
    ["note", note(), note("note-2", "tree-02")],
    ["flower", flower(), flower("flower-2", "north-pool-north-02")],
  ]) {
    const responses = await Promise.all([emit(a, `${kind}:create`, payload), emit(b, `${kind}:create`, payload)]);
    assert.equal(responses.filter((result) => result.ok).length, 1);
    const loserIndex = responses.findIndex((result) => !result.ok);
    assert.equal(responses[loserIndex].error.code, "ANCHOR_OCCUPIED");
    assert.equal((await emit([a, b][loserIndex], `${kind}:create`, alternate)).ok, true);
  }
});

test("successful retries return the same record without rebroadcasting", async (t) => {
  const { client } = await fixture(t, { contributionLimit: 1 });
  const a = await client();
  await join(a);
  const broadcasts = [];
  a.on("flower:created", (event) => broadcasts.push(event));
  const first = await emit(a, "flower:create", flower());
  const duplicate = await emit(a, "flower:create", flower());
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(first.record.id, duplicate.record.id);
  assert.equal(broadcasts.length, 1);
  const changed = await emit(a, "flower:create", flower("flower-1", "north-pool-north-02"));
  assert.equal(changed.error.code, "REQUEST_ID_REUSED");
  const limited = await emit(a, "flower:create", flower("flower-2", "north-pool-north-02"));
  assert.equal(limited.error.code, "RATE_LIMITED");
  assert.ok(limited.error.retryAfterMs > 0);
});

test("invalid payloads cannot spoof authors, coordinates, anchors or flower fields", async (t) => {
  const { client } = await fixture(t, { contributionLimit: 100 });
  const a = await client();
  assert.equal((await emit(a, "note:create", note())).error.code, "NOT_IN_ROOM");
  for (const profile of [
    null,
    { roomId: "bad room", username: "A", avatarType: "male" },
    { roomId: "ok", username: "x".repeat(25), avatarType: "male" },
    { roomId: "ok", username: " ", avatarType: "male" },
    { roomId: "ok", username: "A", avatarType: "unknown" },
    { roomId: "ok", username: "A", avatarType: "male", visitorId: "spoof" },
  ]) assert.equal((await emit(a, "room:join", profile)).ok, false);
  await join(a);
  const invalid = [
    ["note", null], ["note", []],
    ["note", { ...note(), text: "x".repeat(181) }],
    ["note", { ...note(), text: " " }],
    ["note", { ...note(), text: "\u0000" }],
    ["note", { ...note(), anchorId: "unknown" }],
    ["note", { ...note(), authorName: "spoof" }],
    ["note", { ...note(), requestId: "" }],
    ["flower", { ...flower(), poolSide: "unknown" }],
    ["flower", { ...flower(), poolSide: "east" }],
    ["flower", { ...flower(), anchorId: "unknown" }],
    ["flower", { ...flower(), position: [999, 0, 999] }],
    ["flower", { ...flower(), x: 1, y: 0, z: 1 }],
    ["flower", { ...flower(), dedication: "No" }],
    ["flower", { ...flower(), text: "No" }],
    ["flower", { ...flower(), recipientName: "No" }],
    ["flower", { ...flower(), flowerType: "No" }],
  ];
  for (const [kind, payload] of invalid) {
    const errorEvent = once(a, "placement:error");
    const response = await emit(a, `${kind}:create`, payload);
    assert.equal(response.ok, false);
    assert.deepEqual((await errorEvent)[0].error, response.error);
  }
  assert.equal((await emit(a, "presence:update", { currentZone: "unknown" })).ok, false);
  const html = '<script>alert("hello")</script>';
  const result = await emit(a, "note:create", { ...note(), text: html });
  assert.equal(result.record.text, html);
  assert.equal((await join(a)).state.flowers.length, 0);
});

test("leaving, switching rooms and reconnecting remove stale presence but retain contributions", async (t) => {
  const { client } = await fixture(t);
  const [a, b] = await Promise.all([client(), client()]);
  await join(a, "old");
  const original = await join(b, "old");
  await emit(b, "flower:create", flower());
  const departed = once(a, "presence:leave");
  await join(b, "new");
  assert.equal((await departed)[0].visitorId, original.visitor.visitorId);
  assert.equal((await join(a, "old")).state.visitors.length, 1);
  await join(b, "old");
  const disconnected = once(a, "presence:leave");
  b.disconnect();
  await disconnected;
  b.connect();
  await once(b, "connect");
  const rejoined = await join(b, "old");
  assert.equal(rejoined.state.visitors.length, 2);
  assert.equal(rejoined.state.flowers.length, 1);
  assert.notEqual(rejoined.visitor.visitorId, original.visitor.visitorId);
  const left = once(a, "presence:leave");
  assert.equal((await emit(b, "presence:leave", {})).ok, true);
  await left;
  assert.equal((await emit(b, "flower:create", flower("next"))).error.code, "NOT_IN_ROOM");
});

test("rate window expires and invalid attempts consume the allowance", () => {
  let now = 1000;
  const repository = new ContributionRepository();
  const service = new PlacementService(repository, {
    contributionLimit: 1, contributionWindowMs: 100,
  }, () => now);
  const socket = { id: "socket", data: { roomId: "room" } };
  const visitor = { visitorId: "visitor", username: "A", avatarType: "male" };
  assert.throws(() => service.create(socket, "note", null, visitor), { code: "INVALID_PAYLOAD" });
  assert.throws(() => service.create(socket, "note", note(), visitor), { code: "RATE_LIMITED" });
  now += 100;
  assert.equal(service.create(socket, "note", note(), visitor).duplicate, false);
  service.disconnect(socket.id);
  assert.equal(service.attempts.size, 0);
});

test("text limits count Unicode code points and every configured pool side is usable", async (t) => {
  const { client } = await fixture(t, { contributionLimit: 20 });
  const a = await client();
  const profile = await join(a, "boundaries", "\u{1f33f}".repeat(24));
  assert.equal(profile.ok, true);
  const atLimit = await emit(a, "note:create", { ...note(), text: "\u{1f33f}".repeat(180) });
  assert.equal(atLimit.ok, true);
  const overLimit = await emit(a, "note:create", {
    ...note("too-long", "tree-02"), text: "\u{1f33f}".repeat(181),
  });
  assert.equal(overLimit.error.code, "INVALID_TEXT");
  for (const side of ["north", "east", "south", "west"]) {
    const placed = await emit(a, "flower:create", {
      requestId: `side-${side}`,
      poolSide: side,
      anchorId: `north-pool-${side}-12`,
    });
    assert.equal(placed.ok, true);
    const outOfRange = await emit(a, "flower:create", {
      requestId: `outside-${side}`,
      poolSide: side,
      anchorId: `north-pool-${side}-13`,
    });
    assert.equal(outOfRange.error.code, "INVALID_CHOICE");
  }
});

test("configuration validates environment settings", () => {
  assert.equal(readConfig({ PORT: "8080" }).port, 8080);
  for (const env of [
    { PORT: "bad" }, { PORT: "65536" }, { CONTRIBUTION_LIMIT: "0" },
    { CORS_ORIGINS: "*" }, { CORS_ORIGINS: "https://user.github.io/repo" },
  ]) assert.throws(() => readConfig(env));
});

test("saved identity survives reconnects and profile edits update peers in place", async (t) => {
  const { client } = await fixture(t);
  const [a, b] = await Promise.all([client(), client()]);
  const initialPresence = once(a, "presence:update");
  await join(a);
  await initialPresence;
  const visitorId = randomUUID();
  const profile = { roomId: "memorial", visitorId, username: "Ada", avatarType: "female" };
  const announced = once(a, "presence:update");
  const joined = await emit(b, "room:join", profile);
  await announced;
  assert.equal(joined.visitor.visitorId, visitorId);
  const socketId = b.id;
  const updated = once(a, "presence:update");
  const result = await emit(b, "presence:update", { username: "Ada Rose", avatarType: "male" });
  assert.equal(result.ok, true);
  assert.equal(result.visitor.socketId, socketId);
  assert.equal(result.visitor.joinedAt, joined.visitor.joinedAt);
  const event = (await updated)[0];
  assert.equal(event.visitor.username, "Ada Rose");
  assert.equal(event.visitor.avatarType, "male");
  assert.equal((await emit(b, "presence:update", { visitorId: randomUUID() })).ok, false);
  assert.equal((await emit(b, "presence:update", { username: "x".repeat(25) })).ok, false);
  const placed = await emit(b, "flower:create", flower());
  assert.equal(placed.record.authorName, "Ada Rose");
  const left = once(a, "presence:leave");
  b.disconnect();
  await left;
  const connected = once(b, "connect");
  b.connect();
  await connected;
  const rejoined = await emit(b, "room:join", { ...profile, username: "Ada Rose", avatarType: "male" });
  assert.equal(rejoined.visitor.visitorId, visitorId);
  assert.notEqual(rejoined.visitor.socketId, socketId);
  const retry = await emit(b, "flower:create", flower());
  assert.equal(retry.duplicate, true);
  assert.equal(retry.record.id, placed.record.id);
});
