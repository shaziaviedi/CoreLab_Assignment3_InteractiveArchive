export const EVENTS = Object.freeze({
  JOIN: "room:join",
  STATE: "room:state",
  PRESENCE_UPDATE: "presence:update",
  PRESENCE_LEAVE: "presence:leave",
  NOTE_CREATE: "note:create",
  NOTE_CREATED: "note:created",
  FLOWER_CREATE: "flower:create",
  FLOWER_CREATED: "flower:created",
  PLACEMENT_ERROR: "placement:error",
});

export const AVATAR_TYPES = Object.freeze(["male", "female"]);
export const ZONES = Object.freeze(["overview", "tree", "north", "street"]);
export const POOL_SIDES = Object.freeze(["north", "east", "south", "west"]);
export const ROSE_COLORS = Object.freeze(["white", "palePink", "red", "peach", "lavender"]);
export const LIMITS = Object.freeze({ username: 24, note: 180, roomId: 64 });

export const ACTIVITIES = Object.freeze(["idle", "writing-note", "placing-note", "reading-note", "placing-flower", "photographing"]);
export const ACTIVITY_TTL_MS = 20000;
