import React, { useEffect, useState } from "react";
import { ACTIVITY_LABELS, ZONE_LABELS, visitorActivity } from "../presence/presentation.js";
import { useCollaboration } from "../CollaborationProvider.jsx";

// Zone/activity are shared; camera transforms and puzzle progress stay local.
export function VisitorZone({ zone, activity = "idle" }) {
  const { updateZone } = useCollaboration();
  useEffect(() => updateZone(zone, activity), [zone, activity, updateZone]);
  return null;
}

export default function VisitorPresence() {
  const { visitors, identity } = useCollaboration();
  const now = useActivityClock(visitors);
  return (
    <ul className="visitor-list" aria-label="Connected visitors">
      {visitors.map((visitor) => (
        <li key={visitor.socketId}>
          <span className="visitor-avatar-mark" aria-hidden="true">
            {visitor.avatarType === "female" ? "F" : "M"}
          </span>
          <span>{visitor.username}{visitor.visitorId === identity?.visitorId ? " (you)" : ""}</span>
          <small>{visitor.avatarType === "female" ? "Female avatar" : "Male avatar"} · {ZONE_LABELS[visitor.currentZone]}{ACTIVITY_LABELS[visitorActivity(visitor, now)] && ` · ${ACTIVITY_LABELS[visitorActivity(visitor, now)]}`}</small>
        </li>
      ))}
    </ul>
  );
}

export function useActivityClock(visitors) {
  const [now, setNow] = useState(Date.now);
  const active = visitors.some((visitor) => visitorActivity(visitor) !== "idle");
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
