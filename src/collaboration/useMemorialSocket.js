import { useCallback, useEffect, useRef, useState } from "react";
import { EVENTS } from "../../shared/protocol.js";
import { LAYOUT_VERSION } from "../../shared/memorialLayout.js";
import { createPresencePublisher } from "./presence/presencePublisher.js";
import { createMemorialSocket } from "./socket.js";
import { submitFlower } from "./flowers/flowerSubmission.js";
import { submitTreeNote } from "./tree/noteSubmission.js";
import { collaborationConfig } from "./config.js";

const upsert = (items, item, key) => [
  ...items.filter((existing) => existing[key] !== item[key]),
  item,
];

export default function useMemorialSocket(
  identity, roomId, enabled = collaborationConfig().enabled,
  socketFactory = createMemorialSocket,
) {
  const [notes, setNotes] = useState([]);
  const [flowers, setFlowers] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [status, setStatus] = useState(enabled ? "disconnected" : "offline");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState(null);
  const announced = useRef(new Set());
  const announcementTime = useRef(-Infinity);
  const socketRef = useRef(null);
  const selfProfileRef = useRef(null);
  const identityRef = useRef(identity);
  const zoneRef = useRef("overview");
  const activityRef = useRef("idle");
  const publisherRef = useRef(null);
  const currentPresence = useCallback(() => ({
    username: identityRef.current?.username, avatarType: identityRef.current?.avatarType,
    currentZone: zoneRef.current, activity: activityRef.current,
  }), []);
  const announce = useCallback((record, kind) => {
    if (announced.current.has(record.id)) return;
    announced.current.add(record.id);
    if (announced.current.size > 256) announced.current.delete(announced.current.values().next().value);
    const own = record.authorId === identityRef.current?.visitorId;
    if (!own && Date.now() - announcementTime.current < 6000) return;
    announcementTime.current = Date.now();
    setAnnouncement({ id: record.id, kind, own, expiresAt: Date.now() + 3500, text: own ? (kind === "note" ? "Your message is attached." : "Your flower has been placed.") :
      (kind === "note" ? "A visitor left a message." : "A visitor left a flower.") });
  }, []);
  const ready = useRef(false);
  const visitorId = identity?.visitorId;

  useEffect(() => {
    identityRef.current = identity;
    const socket = socketRef.current;
    if (!socket?.connected || !ready.current || !identity) return;
    publisherRef.current?.publish(currentPresence());
  }, [identity, currentPresence]);

  useEffect(() => {
    if (!enabled) {
      ready.current = false;
      setStatus("offline");
      setAnnouncement(null);
      setVisitors([]);
      setError("");
      return;
    }
    if (!visitorId || !roomId) return;
    let socket;
    try {
      socket = socketFactory();
    } catch (failure) {
      setError(failure.message);
      return;
    }
    socketRef.current = socket;
    const publisher = createPresencePublisher((profile) => {
      if (!ready.current || !socket.connected) return;
      const hidden = typeof document !== "undefined" && document.hidden;
      socket.timeout(5000).emit(EVENTS.PRESENCE_UPDATE, hidden ? { ...profile, activity: "idle" } : profile, (timeout, result) => {
        if (disposed || socketRef.current !== socket) return;
        if (result?.ok && result.visitor) selfProfileRef.current = result.visitor;
        setError(timeout ? "Presence sync interrupted. You can keep exploring." : result?.ok ? "" : result?.error?.message || "Presence update failed.");
      });
    });
    publisherRef.current = publisher;
    setStatus("reconnecting");
    let revision = -1;
    let disposed = false;
    const inRoom = (event) => event.roomId === roomId;
    const onState = (state) => {
      if (!inRoom(state)) return;
      // A stale deployed client must not attach contributions to a different layout.
      if (state.layoutVersion !== LAYOUT_VERSION) {
        ready.current = false;
        socket.disconnect();
        setNotes([]);
        setFlowers([]);
        setVisitors([]);
        setStatus("disconnected");
        setError("The memorial layout has changed. Reload this page before contributing.");
        return;
      }
      revision = state.revision;
      // Joining/reconnecting does not announce historical contributions.
      announced.current = new Set([...state.notes, ...state.flowers].map((record) => record.id));
      setNotes(state.notes);
      setFlowers(state.flowers);
      setVisitors(state.visitors);
      ready.current = true;
      setStatus("connected");
      setError("");
      // Edits or camera changes made during the join still need to reach peers.
      const self = state.visitors.find((visitor) => visitor.socketId === socket.id);
      selfProfileRef.current = self;
      const profile = identityRef.current;
      if (self && (self.username !== profile.username ||
        self.avatarType !== profile.avatarType || self.currentZone !== zoneRef.current || (self.activity ?? "idle") !== activityRef.current))
        publisher.publish(currentPresence());
    };
    const onConnect = () => {
      ready.current = false;
      socket.timeout(5000).emit(EVENTS.JOIN, {
        roomId,
        ...identityRef.current,
        currentZone: zoneRef.current,
        activity: activityRef.current,
      }, (timeout, result) => {
        if (disposed) return;
        // room:state is applied once; reapplying the ack could erase newer events.
        if (timeout && !ready.current) {
          setStatus("disconnected");
          setError("Joining timed out. Reconnect to try again.");
        } else if (!timeout && !result?.ok) {
          setStatus("disconnected");
          setError(result?.error?.message || "Could not join this room.");
        }
      });
    };
    const onDisconnect = () => {
      publisher.cancel();
      selfProfileRef.current = null;
      setAnnouncement(null);
      ready.current = false;
      setVisitors([]);
      setStatus(socket.active ? "reconnecting" : "disconnected");
    };
    const onConnectError = () => {
      setStatus(socket.active ? "reconnecting" : "disconnected");
      setError("The memorial server is unavailable. You can keep exploring.");
    };
    const onReconnect = () => setStatus("reconnecting");
    const onPresence = (event) => {
      if (!inRoom(event) || !ready.current) return;
      if (event.visitor.socketId === socket.id) selfProfileRef.current = event.visitor;
      setVisitors((old) => upsert(old, event.visitor, "socketId"));
    };
    const onLeave = (event) => {
      if (inRoom(event))
        setVisitors((old) => old.filter((visitor) => visitor.socketId !== event.socketId));
    };
    const contribution = (kind, update) => (event) => {
      if (!ready.current || !inRoom(event) || event.revision <= revision) return;
      revision = event.revision;
      update((old) => upsert(old, event[kind], "id"));
      announce(event[kind], kind);
    };
    const listeners = [
      ["connect", onConnect],
      ["disconnect", onDisconnect],
      ["connect_error", onConnectError],
      [EVENTS.STATE, onState],
      [EVENTS.PRESENCE_UPDATE, onPresence],
      [EVENTS.PRESENCE_LEAVE, onLeave],
      [EVENTS.NOTE_CREATED, contribution("note", setNotes)],
      [EVENTS.FLOWER_CREATED, contribution("flower", setFlowers)],
    ];
    for (const [event, listener] of listeners) socket.on(event, listener);
    socket.io.on("reconnect_attempt", onReconnect);
    socket.connect();
    const refreshActivity = () => {
      if (ready.current && activityRef.current !== "idle") publisher.publish(currentPresence(), true);
    };
    const heartbeat = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) refreshActivity();
    }, 8000);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", refreshActivity);
    return () => {
      clearInterval(heartbeat);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", refreshActivity);
      publisher.cancel();
      publisherRef.current = null;
      disposed = true;
      ready.current = false;
      for (const [event, listener] of listeners) socket.off(event, listener);
      socket.io.off("reconnect_attempt", onReconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [visitorId, roomId, enabled, socketFactory, currentPresence, announce]);

  const updateZone = useCallback((currentZone, activity = "idle") => {
    zoneRef.current = currentZone;
    activityRef.current = activity;
    if (socketRef.current?.connected && ready.current) publisherRef.current?.publish(currentPresence());
  }, [currentPresence]);
  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      setStatus("reconnecting");
      socket.disconnect().connect();
    }
  }, []);

  const profileSyncError = useCallback(() => {
    const self = selfProfileRef.current, profile = identityRef.current;
    if (self && profile && (self.username !== profile.username || self.avatarType !== profile.avatarType))
      return { ok: false, error: { code: "PROFILE_SYNCING", message: "Your profile is updating. Please try again in a moment." } };
    return null;
  }, []);

  const createNote = useCallback(async (payload) => {
    const syncing = profileSyncError();
    if (syncing) return syncing;
    const socket = socketRef.current;
    const result = await submitTreeNote(socket, ready.current, payload);
    // The broadcast usually arrives first. Applying the authoritative ack also
    // handles an idempotent retry whose original broadcast was missed.
    if (result.ok && socketRef.current === socket && result.record?.roomId === roomId)
      { setNotes((old) => upsert(old, result.record, "id")); announce(result.record, "note"); }
    return result;
  }, [roomId, announce, profileSyncError]);

  const createFlower = useCallback(async (payload) => {
    const syncing = profileSyncError();
    if (syncing) return syncing;
    const socket = socketRef.current;
    const result = await submitFlower(socket, ready.current, { ...payload, roomId });
    if (result.ok && socketRef.current === socket && result.record?.roomId === roomId)
      { setFlowers((old) => upsert(old, result.record, "id")); announce(result.record, "flower"); }
    return result;
  }, [roomId, announce, profileSyncError]);

  return { notes, flowers, visitors, status, error, announcement, reconnect, updateZone, createNote, createFlower };
}
