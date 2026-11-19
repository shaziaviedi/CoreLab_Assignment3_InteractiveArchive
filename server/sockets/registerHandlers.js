import { EVENTS } from "../../shared/protocol.js";
import { roomChannel } from "../services/roomService.js";
import {
  RequestError,
  validateFields,
  validateJoin,
  validatePresence,
} from "../validation.js";

export function registerHandlers(io, socket, rooms, placements) {
  const acknowledge = (ack, response) => {
    if (typeof ack === "function") ack(response);
  };
  const failure = (ack, error, event, payload) => {
    if (!(error instanceof RequestError)) console.error(error);
    const response = {
      ok: false,
      error: {
        code: error instanceof RequestError ? error.code : "INTERNAL_ERROR",
        message: error instanceof RequestError
          ? error.message
          : "The request could not be completed.",
        ...(error instanceof RequestError ? error.details : {}),
      },
    };
    acknowledge(ack, response);
    if (event === EVENTS.NOTE_CREATE || event === EVENTS.FLOWER_CREATE)
      socket.emit(EVENTS.PLACEMENT_ERROR, {
        ...response,
        event,
        requestId: typeof payload?.requestId === "string"
          ? payload.requestId.slice(0, 80)
          : null,
      });
  };
  const leave = () => {
    const departed = rooms.leave(socket);
    if (!departed) return;
    socket.leave(roomChannel(departed.roomId));
    io.to(roomChannel(departed.roomId)).emit(EVENTS.PRESENCE_LEAVE, departed);
  };

  socket.on(EVENTS.JOIN, (payload, ack) => {
    try {
      const profile = validateJoin(payload);
      // Membership operations are synchronous with the default in-memory adapter.
      leave();
      socket.join(roomChannel(profile.roomId));
      const visitor = rooms.join(socket, profile);
      const state = rooms.snapshot(profile.roomId);
      socket.emit(EVENTS.STATE, state);
      acknowledge(ack, { ok: true, visitor, state });
      io.to(roomChannel(profile.roomId)).emit(EVENTS.PRESENCE_UPDATE, {
        roomId: profile.roomId,
        visitor,
      });
    } catch (error) {
      failure(ack, error, EVENTS.JOIN, payload);
    }
  });

  socket.on(EVENTS.PRESENCE_UPDATE, (payload, ack) => {
    try {
      const changes = validatePresence(payload);
      const visitor = rooms.update(socket, changes);
      io.to(roomChannel(socket.data.roomId)).emit(EVENTS.PRESENCE_UPDATE, {
        roomId: socket.data.roomId,
        visitor,
      });
      acknowledge(ack, { ok: true, visitor });
    } catch (error) {
      failure(ack, error, EVENTS.PRESENCE_UPDATE, payload);
    }
  });

  socket.on(EVENTS.PRESENCE_LEAVE, (payload, ack) => {
    try {
      validateFields(payload, []);
      leave();
      acknowledge(ack, { ok: true });
    } catch (error) {
      failure(ack, error, EVENTS.PRESENCE_LEAVE, payload);
    }
  });

  for (const [kind, incoming, outgoing] of [
    ["note", EVENTS.NOTE_CREATE, EVENTS.NOTE_CREATED],
    ["flower", EVENTS.FLOWER_CREATE, EVENTS.FLOWER_CREATED],
  ]) {
    socket.on(incoming, (payload, ack) => {
      try {
        const visitor = rooms.requireVisitor(socket);
        const result = placements.create(socket, kind, payload, visitor);
        if (!result.duplicate)
          io.to(roomChannel(socket.data.roomId)).emit(outgoing, {
            roomId: socket.data.roomId,
            revision: result.revision,
            [kind]: result.record,
          });
        acknowledge(ack, { ok: true, ...result });
      } catch (error) {
        failure(ack, error, incoming, payload);
      }
    });
  }

  socket.on("disconnect", () => {
    leave();
    placements.disconnect(socket.id);
  });
}
