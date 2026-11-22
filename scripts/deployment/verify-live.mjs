import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { io } from "socket.io-client";
import { EVENTS } from "../../shared/protocol.js";
import { LAYOUT_VERSION } from "../../shared/memorialLayout.js";
import { PUBLIC_ASSETS } from "../../src/scene/assetManifest.js";
import { verifyBackend } from "./verify-backend.mjs";

const timeout = 30000;
async function eventually(predicate, description) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, `Timed out: ${description}`);
    await delay(25);
  }
}
async function get(url, origin) {
  const response = await fetch(url, {
    headers: origin ? { Origin: origin } : {}, signal: AbortSignal.timeout(90000),
  });
  assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
  return response;
}
function request(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeout).emit(event, payload, (error, response) => {
      if (error) reject(new Error(`${event}: no acknowledgement`));
      else resolve(response);
    });
  });
}

// Network checks complement the browser checklist; they cannot verify WebGL or gestures.
export async function verifyLive(frontendUrl, backendUrl) {
  const frontend = new URL(frontendUrl), backend = new URL(backendUrl);
  for (const url of [frontend, backend]) {
    assert.ok(["https:", "http:"].includes(url.protocol), "Use HTTP(S) URLs.");
    assert.ok(!url.username && !url.password, "Deployment URLs must not contain credentials.");
  }
  assert.equal(backend.origin, backendUrl, "Use the backend origin without a path or trailing slash.");
  assert.ok(frontend.pathname.endsWith("/"), "The frontend URL must end in /, including the Pages repository path.");
  frontend.search = "";
  frontend.hash = "";
  const origin = frontend.origin;
  await verifyBackend(backend.origin, frontend.href);
  const roomId = `deployment-check-${randomUUID()}`;
  const roomUrl = new URL(frontend);
  roomUrl.searchParams.set("room", roomId);
  const html = await (await get(roomUrl)).text();
  assert.match(html, /id="root"/, "Frontend must serve the React entry page at a room link.");
  const scriptPaths = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(scriptPaths.length, "No frontend entry script found.");
  const scripts = await Promise.all(scriptPaths.map(async (path) => {
    const url = new URL(path, frontend);
    assert.ok(url.pathname.startsWith(frontend.pathname), "Frontend script lost the Pages repository base.");
    return (await get(url)).text();
  }));
  assert.ok(scripts.some((script) => script.includes(backend.origin)), "Published frontend does not reference this backend. Rebuild with VITE_SOCKET_URL.");
  // Check actual bytes: a static-host fallback can return HTML with status 200.
  for (const asset of PUBLIC_ASSETS) {
    const response = await get(new URL(asset, frontend));
    const bytes = Buffer.from(await response.arrayBuffer());
    if (asset.endsWith(".glb")) assert.equal(bytes.toString("ascii", 0, 4), "glTF", `${asset}: expected GLB, not an HTML fallback`);
    else assert.match(bytes.toString(), /<svg[\s>]/, `${asset}: expected SVG`);
  }

  const clients = [];
  function client(username, avatarType, transport) {
    const socket = io(backend.origin, {
      autoConnect: false, forceNew: true, reconnection: false,
      transports: [transport], timeout,
      extraHeaders: { Origin: origin },
    });
    const peer = { socket, profile: { roomId, visitorId: randomUUID(), username, avatarType }, visitors: new Map(), notes: new Map(), flowers: new Map() };
    socket.on(EVENTS.STATE, (state) => {
      peer.state = state;
      peer.visitors = new Map(state.visitors.map((visitor) => [visitor.socketId, visitor]));
      peer.notes = new Map(state.notes.map((note) => [note.id, note]));
      peer.flowers = new Map(state.flowers.map((flower) => [flower.id, flower]));
    });
    socket.on(EVENTS.PRESENCE_UPDATE, ({ visitor }) => peer.visitors.set(visitor.socketId, visitor));
    socket.on(EVENTS.PRESENCE_LEAVE, ({ socketId }) => peer.visitors.delete(socketId));
    socket.on(EVENTS.NOTE_CREATED, ({ note }) => peer.notes.set(note.id, note));
    socket.on(EVENTS.FLOWER_CREATED, ({ flower }) => peer.flowers.set(flower.id, flower));
    clients.push(peer);
    return peer;
  }
  async function join(peer) {
    await new Promise((resolve, reject) => {
      const connected = () => { cleanup(); resolve(); };
      const failed = (error) => { cleanup(); reject(error); };
      const cleanup = () => { peer.socket.off("connect", connected); peer.socket.off("connect_error", failed); };
      peer.socket.once("connect", connected).once("connect_error", failed).connect();
    });
    const response = await request(peer.socket, EVENTS.JOIN, peer.profile);
    assert.equal(response?.ok, true, JSON.stringify(response?.error));
    assert.equal(response.state.layoutVersion, LAYOUT_VERSION);
  }
  try {
    // Both supported transports are checked, with independent identities/sessions.
    const a = client("Deployment visitor A", "male", "websocket");
    const b = client("Deployment visitor B", "female", "polling");
    await join(a);
    await join(b);
    await eventually(() => a.visitors.size === 2 && b.visitors.size === 2, "two-client presence");
    assert.equal(a.visitors.get(b.socket.id).avatarType, "female");
    assert.equal(b.visitors.get(a.socket.id).username, a.profile.username);
    const note = await request(a.socket, EVENTS.NOTE_CREATE, { requestId: randomUUID(), anchorId: "tree-01", text: "A quiet connection check." });
    assert.equal(note.ok, true);
    await eventually(() => b.notes.has(note.record.id), "shared note");
    const flower = await request(b.socket, EVENTS.FLOWER_CREATE, { requestId: randomUUID(), roomId, poolSide: "north", anchorId: "north-pool-north-01" });
    assert.equal(flower.ok, true);
    await eventually(() => a.flowers.has(flower.record.id), "shared flower");
    assert.equal(a.flowers.get(flower.record.id).authorName, b.profile.username);
    assert.equal(new Date(flower.record.createdAt).toISOString(), flower.record.createdAt);
    const race = await Promise.all([a, b].map((peer) => request(peer.socket, EVENTS.FLOWER_CREATE, {
      requestId: randomUUID(), roomId, poolSide: "south", anchorId: "north-pool-south-01",
    })));
    assert.equal(race.filter((reply) => reply.ok).length, 1);
    assert.equal(race.find((reply) => !reply.ok)?.error.code, "ANCHOR_OCCUPIED");
    const c = client("Deployment visitor C", "male", "websocket");
    await join(c);
    assert.equal(c.notes.size, 1);
    assert.equal(c.flowers.size, 2);
    a.socket.disconnect();
    await eventually(() => b.visitors.size === 2, "presence removal");
    await join(a);
    assert.equal(a.notes.size, 1);
    assert.equal(a.flowers.size, 2);
    return { frontend: frontend.href, backend: backend.origin, roomId, publicAssets: PUBLIC_ASSETS.length,
      transports: ["websocket", "polling"], sharedNotes: 1, sharedFlowers: 2, conflict: "ANCHOR_OCCUPIED", reconnect: "passed" };
  } finally {
    for (const peer of clients) { peer.socket.removeAllListeners(); peer.socket.disconnect(); }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assert.ok(process.env.FRONTEND_URL && process.env.VITE_SOCKET_URL, "Set FRONTEND_URL and VITE_SOCKET_URL to the published URLs.");
    console.log(JSON.stringify(await verifyLive(process.env.FRONTEND_URL, process.env.VITE_SOCKET_URL), null, 2));
  } catch (error) {
    console.error(`Deployment verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
