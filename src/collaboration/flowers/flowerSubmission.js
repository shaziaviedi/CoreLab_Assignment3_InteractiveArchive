import { EVENTS } from "../../../shared/protocol.js";

export function submitFlower(socket, ready, payload) {
  if (!socket?.connected || !ready)
    return Promise.resolve({ ok: false, error: { code: "DISCONNECTED", message: "Reconnect before leaving a flower." } });
  return new Promise((resolve) => {
    socket.timeout(7000).emit(EVENTS.FLOWER_CREATE, payload, (timeout, result) => {
      resolve(timeout
        ? { ok: false, error: { code: "ACK_TIMEOUT", message: "Placement could not be confirmed. Your next click on this position will safely retry it." } }
        : result ?? { ok: false, error: { code: "INVALID_REPLY", message: "The server could not confirm this flower. Please try again." } });
    });
  });
}
