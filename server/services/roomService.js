import { randomUUID } from "node:crypto";
import { LAYOUT_VERSION } from "../../shared/memorialLayout.js";
import { RequestError } from "../validation.js";

export const roomChannel = (roomId) => `memorial:${roomId}`;

export class RoomService {
  constructor(repository) {
    this.repository = repository;
  }

  join(socket, profile) {
    const visitor = {
      socketId: socket.id,
      visitorId: socket.data.visitorId ?? profile.visitorId ?? randomUUID(),
      username: profile.username,
      avatarType: profile.avatarType,
      currentZone: profile.currentZone,
      joinedAt: new Date().toISOString(),
    };
    socket.data.visitorId = visitor.visitorId;
    socket.data.roomId = profile.roomId;
    socket.data.visitor = visitor;
    this.repository.putVisitor(profile.roomId, visitor);
    return visitor;
  }

  requireVisitor(socket) {
    if (!socket.data.visitor)
      throw new RequestError("NOT_IN_ROOM", "Join a memorial room first.");
    return socket.data.visitor;
  }

  update(socket, changes) {
    const visitor = { ...this.requireVisitor(socket), ...changes };
    socket.data.visitor = visitor;
    this.repository.putVisitor(socket.data.roomId, visitor);
    return visitor;
  }

  leave(socket) {
    const { roomId, visitor } = socket.data;
    if (!visitor) return null;
    this.repository.removeVisitor(roomId, socket.id);
    delete socket.data.roomId;
    delete socket.data.visitor;
    return { roomId, socketId: socket.id, visitorId: visitor.visitorId };
  }

  snapshot(roomId) {
    return { ...this.repository.snapshot(roomId), layoutVersion: LAYOUT_VERSION };
  }
}
