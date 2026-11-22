import React from "react";
import { useCollaboration } from "../CollaborationProvider.jsx";
import RoomShare from "./RoomShare.jsx";
import VisitorPresence from "./VisitorPresence.jsx";

export default function CollaborationStatus({ onEdit }) {
  const { identity, status, visitors, error, storageWarning, reconnect, roomId } = useCollaboration();
  return (
    <aside className="collaboration-status" aria-label="Memorial connection">
      <details>
        <summary>
          <span className={`connection-dot ${status}`} aria-hidden="true" />
          <span role="status">{status === "offline" ? "Offline development" : status === "connected" ? "Connected" :
            status === "reconnecting" ? "Reconnecting" : "Disconnected"} · {visitors.length} {visitors.length === 1 ? "visitor" : "visitors"}</span>
        </summary>
        <div className="presence-panel">
          <p>Room · {roomId || "Invalid link"}</p>
          <RoomShare roomId={roomId} />
          <VisitorPresence />
          {error && <p role="status">{error}</p>}
          {storageWarning && <p>{storageWarning}</p>}
          {status !== "offline" && (status !== "connected" || error) && <button onClick={reconnect}>Reconnect</button>}
        </div>
      </details>
      <button className="visitor-edit" onClick={onEdit} aria-label="Edit visitor profile">
        {identity.username}
      </button>
    </aside>
  );
}
