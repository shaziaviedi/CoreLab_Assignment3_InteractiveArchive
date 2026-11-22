import { useCallback, useEffect, useRef, useState } from "react";
import { noteLength } from "./treeNoteLayout.js";
import { placementFromId } from "../../../shared/fenceLayout.js";

export default function useTreeNotes({ active, notes, createNote, status, autoCompose = false }) {
  const [stage, setStage] = useState("idle");
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [focusedAnchorId, focusAnchor] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const request = useRef(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const previousStage = useRef("idle");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (active && autoCompose) setStage("compose");
    if (!active) {
      setStage("idle");
      setSelectedId(null);
      setError("");
    }
  }, [active, autoCompose]);
  useEffect(() => { focusAnchor(null); }, [active, stage]);
  const cancel = useCallback(() => {
    if (busy.current) return;
    setStage((current) => current === "read" ? previousStage.current : "idle");
    setSelectedId(null);
    setError("");
  }, []);
  const begin = useCallback(() => {
    if (busy.current) return;
    setSelectedId(null);
    if (uncertain) { setStage("place"); return; }
    setError("");
    setStage("compose");
  }, [uncertain]);
  const place = useCallback(async (anchorId) => {
    if (busy.current || !active || stage !== "place") return;
    if (uncertain && request.current?.anchorId !== anchorId) return;
    const text = draft.trim();
    if (!text || noteLength(text) > 180) return;
    // Keep the same request on timeout; a different draft or anchor gets a new ID.
    if (request.current?.anchorId !== anchorId || request.current?.text !== text)
      request.current = { requestId: crypto.randomUUID(), anchorId, text,
        fencePosition: placementFromId(anchorId)?.fencePosition };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await createNote(request.current);
      if (!mounted.current) return;
      if (result.ok) {
        setUncertain(false);
        setDraft("");
        setStage("idle");
        request.current = null;
      } else {
        if (["ACK_TIMEOUT", "INVALID_REPLY"].includes(result.error?.code)) setUncertain(true);
        else if (!["DISCONNECTED", "INVALID_REPLY"].includes(result.error?.code)) setUncertain(false);
        setError(result.error?.message || "This tag could not be attached. Your draft is kept.");
      }
    } catch {
      if (mounted.current) {
        setUncertain(true);
        setError("Connection interrupted. Your draft is kept; please retry the last position.");
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, [active, stage, draft, createNote, uncertain]);
  return {
    stage, draft, setDraft, focusedAnchorId, focusAnchor, pending, uncertain, error, status, begin, cancel, place,
    retry: () => { if (request.current) place(request.current.anchorId); },
    continueToPlacement: () => { setError(""); setStage("place"); },
    edit: () => { if (!busy.current && !uncertain) setStage("compose"); },
    viewMessages: () => { if (!busy.current) { setSelectedId(null); setStage("browse"); } },
    read: (id) => { if (!busy.current) { previousStage.current = stage === "read" ? previousStage.current : stage; setSelectedId(id); setStage("read"); } },
    selected: notes.find((note) => note.id === selectedId),
    modal: active && (stage === "compose" || stage === "read"),
  };
}
