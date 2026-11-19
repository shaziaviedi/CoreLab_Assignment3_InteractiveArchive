import { AVATAR_TYPES, LIMITS, POOL_SIDES, ZONES } from "../shared/protocol.js";
import { FLOWER_ANCHORS, NOTE_ANCHORS } from "../shared/memorialLayout.js";

export class RequestError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function validateFields(payload, allowed) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new RequestError("INVALID_PAYLOAD", "Expected an object.");
  if (Object.keys(payload).some((key) => !allowed.includes(key)))
    throw new RequestError("INVALID_PAYLOAD", "Unexpected fields are not allowed.");
}

function text(value, maximum, label) {
  if (typeof value !== "string")
    throw new RequestError("INVALID_TEXT", `${label} must be plain text.`);
  const trimmed = value.trim();
  const hasControlCharacters = /[\u0000-\u0008\u000b-\u001f\u007f]/u.test(value);
  if (!trimmed || [...value].length > maximum || hasControlCharacters)
    throw new RequestError(
      "INVALID_TEXT",
      `${label} must contain 1–${maximum} characters.`,
    );
  // Preserve text literally; clients must render it as text, never as HTML.
  return trimmed;
}

function choice(value, choices, label) {
  if (!choices.includes(value))
    throw new RequestError("INVALID_CHOICE", `Unknown ${label}.`);
  return value;
}

export function validateJoin(payload) {
  validateFields(payload, ["roomId", "visitorId", "username", "avatarType", "currentZone"]);
  if (
    payload.visitorId !== undefined &&
    (typeof payload.visitorId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.visitorId))
  )
    throw new RequestError("INVALID_VISITOR_ID", "Visitor ID must be a UUID v4.");
  if (
    typeof payload.roomId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(payload.roomId)
  )
    throw new RequestError(
      "INVALID_ROOM",
      `Room ID must contain 1–${LIMITS.roomId} letters, numbers, underscores or hyphens.`,
    );
  return {
    roomId: payload.roomId,
    visitorId: payload.visitorId,
    username: text(payload.username, LIMITS.username, "Username"),
    avatarType: choice(payload.avatarType, AVATAR_TYPES, "avatar type"),
    currentZone: choice(payload.currentZone ?? "overview", ZONES, "zone"),
  };
}

export function validatePresence(payload) {
  validateFields(payload, ["currentZone", "username", "avatarType"]);
  if (!Object.keys(payload).length)
    throw new RequestError("INVALID_PAYLOAD", "Provide a zone or profile update.");
  const changes = {};
  if (payload.currentZone !== undefined)
    changes.currentZone = choice(payload.currentZone, ZONES, "zone");
  if (payload.username !== undefined)
    changes.username = text(payload.username, LIMITS.username, "Username");
  if (payload.avatarType !== undefined)
    changes.avatarType = choice(payload.avatarType, AVATAR_TYPES, "avatar type");
  return changes;
}

export function validateContribution(kind, payload) {
  validateFields(
    payload,
    kind === "note"
      ? ["requestId", "anchorId", "text"]
      : ["requestId", "anchorId", "poolSide"],
  );
  if (
    typeof payload.requestId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(payload.requestId)
  )
    throw new RequestError(
      "INVALID_REQUEST_ID",
      "Provide a requestId of 1–80 letters, numbers, underscores or hyphens.",
    );
  if (kind === "note") {
    const noteText = text(payload.text, LIMITS.note, "Note");
    choice(payload.anchorId, NOTE_ANCHORS, "note anchor");
    return { requestId: payload.requestId, anchorId: payload.anchorId, text: noteText };
  }
  const poolSide = choice(payload.poolSide, POOL_SIDES, "pool side");
  choice(payload.anchorId, FLOWER_ANCHORS[poolSide], "flower anchor for this pool side");
  return { requestId: payload.requestId, anchorId: payload.anchorId, poolSide };
}
