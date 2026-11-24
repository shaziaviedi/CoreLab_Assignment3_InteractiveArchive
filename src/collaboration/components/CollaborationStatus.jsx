import React, { lazy, Suspense } from "react";
import { useCollaboration } from "../CollaborationProvider.jsx";
import RoomShare from "./RoomShare.jsx";
import VisitorPresence from "./VisitorPresence.jsx";
const AvatarPreview = lazy(() => import("./AvatarPreview.jsx"));

export default function CollaborationStatus({ onEdit, Preview = AvatarPreview, showProfile = true, mode = "main" }) {
  const { identity, status, visitors, error, storageWarning, reconnect, roomId } = useCollaboration();
  if (!identity) return null;
  return (
    <aside className={`collaboration-status presence-mode-${mode}`} aria-label="Memorial connection">
      {showProfile && <button className="visitor-edit button-circle" onClick={onEdit} aria-label={`Edit visitor profile: ${identity.username}`}>
        <Suspense fallback={null}><Preview avatarType={identity.avatarType} /></Suspense>
      </button>}
      <details>
        <summary>
          <span className={`connection-dot ${status}`} aria-hidden="true" />
          <span role="status">{status === "offline" ? "Offline development" : status === "connected" ? "Connected" :
            status === "reconnecting" ? "Reconnecting" : "Disconnected"} · {visitors.length} {visitors.length === 1 ? "visitor" : "visitors"}</span>
        </summary>
        <div className="presence-panel">
          <RoomShare roomId={roomId} />
          <VisitorPresence />
          {error && <p role="status">{error}</p>}
          {storageWarning && <p>{storageWarning}</p>}
          {status !== "offline" && (status !== "connected" || error) && <button onClick={reconnect}>Reconnect</button>}
        </div>
      </details>
    </aside>
  );
}
