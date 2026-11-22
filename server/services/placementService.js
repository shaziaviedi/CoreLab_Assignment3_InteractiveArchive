import { randomUUID } from "node:crypto";
import { RequestError, validateContribution } from "../validation.js";

export class PlacementService {
  constructor(
    repository,
    { contributionLimit, contributionWindowMs },
    now = Date.now,
  ) {
    this.repository = repository;
    this.limit = contributionLimit;
    this.windowMs = contributionWindowMs;
    this.now = now;
    this.attempts = new Map();
  }

  consumeAttempt(socketId) {
    const now = this.now();
    let window = this.attempts.get(socketId);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.attempts.set(socketId, window);
    }
    if (window.count >= this.limit)
      throw new RequestError(
        "RATE_LIMITED",
        "Please wait before placing another contribution.",
        { retryAfterMs: window.resetAt - now },
      );
    window.count++;
  }

  create(socket, kind, payload, visitor) {
    let input;
    try {
      input = validateContribution(kind, payload);
      // A client may name its room, but cannot place into a room it has not joined.
      if (kind === "flower" && payload.roomId !== undefined && payload.roomId !== socket.data.roomId)
        throw new RequestError("ROOM_MISMATCH", "Rejoin this room before placing a flower.");
    } catch (error) {
      this.consumeAttempt(socket.id);
      throw error;
    }
    const roomId = socket.data.roomId;
    const requestKey = `${visitor.visitorId}:${input.requestId}`;
    const fingerprint = JSON.stringify({ kind, ...input });
    const previous = this.repository.findRequest(roomId, requestKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new RequestError(
          "REQUEST_ID_REUSED",
          "Use a new requestId for a different placement.",
        );
      return { ...previous.result, duplicate: true };
    }
    this.consumeAttempt(socket.id);
    const { requestId, ...placement } = input;
    const record = {
      id: randomUUID(),
      roomId,
      authorId: visitor.visitorId,
      authorName: visitor.username,
      authorAvatar: visitor.avatarType,
      ...placement,
      createdAt: new Date().toISOString(),
    };
    const result = this.repository.insert(
      roomId,
      kind,
      record,
      requestKey,
      fingerprint,
    );
    return { ...result, duplicate: false };
  }

  disconnect(socketId) {
    this.attempts.delete(socketId);
  }
}
