import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IDENTITY_KEY, readIdentity, roomFromUrl, saveIdentity, validProfile } from "./identity.js";
import useMemorialSocket from "./useMemorialSocket.js";

const CollaborationContext = createContext(null);

export default function CollaborationProvider({ children }) {
  const [identity, setIdentity] = useState(readIdentity);
  const [storageWarning, setStorageWarning] = useState("");
  const [room] = useState(() => roomFromUrl());
  const collaboration = useMemorialSocket(identity, room.roomId);

  const updateIdentity = useCallback(({ username, avatarType }) => {
    const next = {
      visitorId: identity?.visitorId ?? crypto.randomUUID(),
      username: username.trim(),
      avatarType,
    };
    if (!validProfile(next)) return false;
    const stored = saveIdentity(next);
    setStorageWarning(stored ? "" : "This browser cannot save your profile. It will last for this visit.");
    setIdentity(next);
    return true;
  }, [identity?.visitorId]);

  useEffect(() => {
    const syncIdentity = (event) => {
      if (event.key !== IDENTITY_KEY) return;
      const saved = readIdentity();
      if (saved) setIdentity(saved);
    };
    window.addEventListener("storage", syncIdentity);
    return () => window.removeEventListener("storage", syncIdentity);
  }, []);

  return (
    <CollaborationContext.Provider value={{
      ...collaboration,
      identity,
      updateIdentity,
      storageWarning,
      roomId: room.roomId,
      error: room.error || collaboration.error,
    }}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration() {
  const context = useContext(CollaborationContext);
  if (!context) throw new Error("useCollaboration requires CollaborationProvider.");
  return context;
}
