import { EVENTS } from "../../../shared/protocol.js";

// Retries reuse requestId: an acknowledgement lost after acceptance cannot duplicate a note.
export function submitTreeNote(socket, ready, payload) {
  if (!socket?.connected || !ready)
    return Promise.resolve({ ok: false, error: { code: "DISCONNECTED", message: "Reconnect before attaching your tag. Your draft is kept." } });
  return new Promise((resolve) => {
    socket.timeout(7000).emit(EVENTS.NOTE_CREATE, payload, (timeout, result) => {
      resolve(timeout
        ? { ok: false, error: { code: "ACK_TIMEOUT", message: "No reply yet. Retry this position after reconnecting; your draft is kept." } }
        : result ?? { ok: false, error: { code: "INVALID_REPLY", message: "The server could not confirm placement. Please retry." } });
    });
  });
}
