import React from "react";
import { useActivityClock } from "../components/VisitorPresence.jsx";
import { ACTIVITY_LABELS, ZONE_LABELS, visitorActivity } from "./presentation.js";

export default function PresenceLabels({ peers, labels }) {
  const now = useActivityClock(peers);
  return (
    <div className="presence-labels" aria-hidden="true">
      {peers.map((visitor) => {
        const activity = visitorActivity(visitor, now);
        return (
          <div key={visitor.socketId} className="presence-label" hidden
            ref={(element) => { if (element) labels.current.set(visitor.socketId, element); else labels.current.delete(visitor.socketId); }}>
            <b>{visitor.username}</b><span>{ZONE_LABELS[visitor.currentZone]}</span>
            {activity !== "idle" && <small><i />{ACTIVITY_LABELS[activity]}</small>}
          </div>
        );
      })}
    </div>
  );
}
