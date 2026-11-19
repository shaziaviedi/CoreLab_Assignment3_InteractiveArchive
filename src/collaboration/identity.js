import { AVATAR_TYPES, LIMITS } from "../../shared/protocol.js";

export const IDENTITY_KEY = "elsewhere:visitor:v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validProfile(value) {
  return value && typeof value.username === "string" &&
    value.username.trim().length > 0 &&
    [...value.username].length <= LIMITS.username &&
    !/[\u0000-\u001f\u007f]/u.test(value.username) &&
    AVATAR_TYPES.includes(value.avatarType) && UUID.test(value.visitorId);
}

export function readIdentity() {
  try {
    const identity = JSON.parse(localStorage.getItem(IDENTITY_KEY));
    if (!validProfile(identity)) return null;
    const { visitorId, username, avatarType } = identity;
    return { visitorId, username, avatarType };
  } catch {
    return null;
  }
}

export function saveIdentity(identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    return true;
  } catch {
    // Private browsing or full storage should not prevent entering the memorial.
    return false;
  }
}

export function roomFromUrl(search = window.location.search) {
  const roomId = new URLSearchParams(search).get("room") ?? "memorial";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomId))
    return { roomId: null, error: "This room link is invalid. Use 1–64 letters, numbers, hyphens or underscores." };
  return { roomId, error: "" };
}
