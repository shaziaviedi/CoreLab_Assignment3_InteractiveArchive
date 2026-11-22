import { RequestError } from "../validation.js";
import { notesOverlap } from "../../shared/fenceLayout.js";

// Process-local storage. Keep mutations here so a database can replace it later.
export class ContributionRepository {
  constructor() {
    this.rooms = new Map();
  }

  getRoom(roomId) {
    if (!this.rooms.has(roomId))
      this.rooms.set(roomId, {
        visitors: new Map(),
        notes: new Map(),
        flowers: new Map(),
        requests: new Map(),
        revision: 0,
      });
    return this.rooms.get(roomId);
  }

  putVisitor(roomId, visitor) {
    this.getRoom(roomId).visitors.set(visitor.socketId, visitor);
  }

  removeVisitor(roomId, socketId) {
    this.getRoom(roomId).visitors.delete(socketId);
  }

  findRequest(roomId, key) {
    return this.getRoom(roomId).requests.get(key);
  }

  insert(roomId, kind, record, requestKey, fingerprint) {
    const room = this.getRoom(roomId);
    const contributions = kind === "note" ? room.notes : room.flowers;
    // No await between occupancy check and insert: the first valid request wins.
    if (contributions.has(record.anchorId) || (kind === "note" && [...contributions.values()].some((note) => notesOverlap(note, record))))
      throw new RequestError(
        "ANCHOR_OCCUPIED",
        "This position is occupied. Choose another position.",
        { anchorId: record.anchorId },
      );
    contributions.set(record.anchorId, record);
    room.revision++;
    const result = { record, revision: room.revision };
    room.requests.set(requestKey, { fingerprint, result });
    return result;
  }

  snapshot(roomId) {
    const room = this.getRoom(roomId);
    return structuredClone({
      roomId,
      revision: room.revision,
      visitors: [...room.visitors.values()],
      notes: [...room.notes.values()],
      flowers: [...room.flowers.values()],
    });
  }
}
