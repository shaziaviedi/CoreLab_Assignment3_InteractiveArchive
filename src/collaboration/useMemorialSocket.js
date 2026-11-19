import { useCallback, useEffect, useRef, useState } from "react";
import { EVENTS } from "../../shared/protocol.js";
import { createMemorialSocket } from "./socket.js";

const upsert = (items, item, key) => [
  ...items.filter((existing) => existing[key] !== item[key]),
  item,
];

export default function useMemorialSocket(identity, roomId) {
  const [notes, setNotes] = useState([]);
  const [flowers, setFlowers] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const identityRef = useRef(identity);
  const zoneRef = useRef("overview");
  const ready = useRef(false);
  const visitorId = identity?.visitorId;

  useEffect(() => {
    identityRef.current = identity;
    const socket = socketRef.current;
    if (!socket?.connected || !ready.current || !identity) return;
    socket.timeout(5000).emit(EVENTS.PRESENCE_UPDATE, {
      username: identity.username,
      avatarType: identity.avatarType,
    }, (timeout, result) => {
      if (socketRef.current !== socket) return;
      setError(timeout ? "Profile update interrupted. Reconnect to sync it." :
        result?.ok ? "" : result?.error?.message || "Profile update failed.");
    });
  }, [identity]);

  useEffect(() => {
    if (!visitorId || !roomId) return;
    let socket;
    try {
      socket = createMemorialSocket();
    } catch (failure) {
      setError(failure.message);
      return;
    }
    socketRef.current = socket;
    setStatus("reconnecting");
    let revision = -1;
    let disposed = false;
    const inRoom = (event) => event.roomId === roomId;
    const onState = (state) => {
      if (!inRoom(state)) return;
      revision = state.revision;
      setNotes(state.notes);
      setFlowers(state.flowers);
      setVisitors(state.visitors);
      ready.current = true;
      setStatus("connected");
      setError("");
      // Edits or camera changes made during the join still need to reach peers.
      const self = state.visitors.find((visitor) => visitor.socketId === socket.id);
      const profile = identityRef.current;
      if (self && (self.username !== profile.username ||
        self.avatarType !== profile.avatarType || self.currentZone !== zoneRef.current))
        socket.emit(EVENTS.PRESENCE_UPDATE, {
          username: profile.username,
          avatarType: profile.avatarType,
          currentZone: zoneRef.current,
        });
    };
    const onConnect = () => {
      ready.current = false;
      socket.timeout(5000).emit(EVENTS.JOIN, {
        roomId,
        ...identityRef.current,
        currentZone: zoneRef.current,
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
      if (inRoom(event) && ready.current)
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
    return () => {
      disposed = true;
      ready.current = false;
      for (const [event, listener] of listeners) socket.off(event, listener);
      socket.io.off("reconnect_attempt", onReconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [visitorId, roomId]);

  const updateZone = useCallback((currentZone) => {
    zoneRef.current = currentZone;
    const socket = socketRef.current;
    if (socket?.connected && ready.current)
      socket.emit(EVENTS.PRESENCE_UPDATE, { currentZone });
  }, []);
  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      setStatus("reconnecting");
      socket.disconnect().connect();
    }
  }, []);

  return { notes, flowers, visitors, status, error, reconnect, updateZone };
}
