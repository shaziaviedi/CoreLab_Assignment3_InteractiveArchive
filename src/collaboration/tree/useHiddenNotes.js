import { useEffect, useState } from "react";

export const hiddenNotesKey = (roomId) => `elsewhere:hidden-notes:v1:${roomId}`;
export function readHiddenNotes(key, storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage).getItem(key));
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 80).slice(-256) : []);
  } catch { return new Set(); }
}

export default function useHiddenNotes(roomId) {
  const key = hiddenNotesKey(roomId);
  const [hiddenNoteIds, setHidden] = useState(() => readHiddenNotes(key));
  const [warning, setWarning] = useState("");
  useEffect(() => {
    setHidden(readHiddenNotes(key));
    setWarning("");
    if (typeof window === "undefined") return;
    const sync = (event) => { if (event.key === key || event.key === null) setHidden(readHiddenNotes(key)); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  function change(id, hidden) {
    const next = new Set(hiddenNoteIds);
    if (hidden) next.add(id); else next.delete(id);
    const bounded = new Set([...next].slice(-256));
    setHidden(bounded);
    try { localStorage.setItem(key, JSON.stringify([...bounded])); setWarning(""); }
    catch { setWarning("Hidden for this visit. This browser could not save that preference."); }
  }
  return { hiddenNoteIds, hideNote: (id) => change(id, true), showNote: (id) => change(id, false), warning };
}
