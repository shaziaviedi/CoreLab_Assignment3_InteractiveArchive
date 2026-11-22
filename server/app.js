import { createServer } from "node:http";
import express from "express";
import { Server } from "socket.io";
import { readConfig } from "./config.js";
import { ContributionRepository } from "./storage/contributionRepository.js";
import { RoomService } from "./services/roomService.js";
import { PlacementService } from "./services/placementService.js";
import { registerHandlers } from "./sockets/registerHandlers.js";
import { LAYOUT_VERSION } from "../shared/memorialLayout.js";

export function createMemorialServer(config = readConfig()) {
  const app = express();
  app.disable("x-powered-by");
  const allowed = (origin) => !origin || config.allowedOrigins.includes(origin);
  app.use((request, response, next) => {
    const origin = request.get("origin");
    response.vary("Origin");
    if (!allowed(origin)) return response.status(403).json({ error: "Origin not allowed." });
    if (origin) response.set("Access-Control-Allow-Origin", origin);
    response.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (request.method === "OPTIONS") return response.sendStatus(204);
    next();
  });
  app.get("/health", (_request, response) => {
    response.set("Cache-Control", "no-store");
    response.json({ status: "ok", service: "elsewhere-memorial", layoutVersion: LAYOUT_VERSION });
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: config.allowedOrigins, methods: ["GET", "POST"] },
    // CORS covers polling; check the origin on WebSocket handshakes too.
    allowRequest: (request, callback) => callback(null, allowed(request.headers.origin)),
    maxHttpBufferSize: 16 * 1024,
  });
  const repository = new ContributionRepository();
  const rooms = new RoomService(repository);
  const placements = new PlacementService(repository, config);
  io.on("connection", (socket) => registerHandlers(io, socket, rooms, placements));
  return { app, httpServer, io };
}
