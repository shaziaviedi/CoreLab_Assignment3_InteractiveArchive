import React, { useEffect } from "react";
import { useCollaboration } from "../CollaborationProvider.jsx";

// Only the zone is shared; camera transforms and puzzle state stay local.
export function VisitorZone({ zone }) {
  const { updateZone } = useCollaboration();
  useEffect(() => updateZone(zone), [zone, updateZone]);
  return null;
}

export default function VisitorPresence() {
  const { visitors, identity } = useCollaboration();
  return (
    <ul className="visitor-list" aria-label="Connected visitors">
      {visitors.map((visitor) => (
        <li key={visitor.socketId}>
          <span className="visitor-avatar-mark" aria-hidden="true">
            {visitor.avatarType === "female" ? "F" : "M"}
          </span>
          <span>{visitor.username}{visitor.visitorId === identity?.visitorId ? " (you)" : ""}</span>
          <small>{visitor.avatarType === "female" ? "Female avatar" : "Male avatar"}</small>
        </li>
      ))}
    </ul>
  );
}
