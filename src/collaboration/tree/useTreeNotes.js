import { useCallback, useEffect, useRef, useState } from "react";
import { noteLength } from "./treeNoteLayout.js";
import { placementFromId } from "../../../shared/fenceLayout.js";

export default function useTreeNotes({
  active, notes, createNote, status, autoCompose = false, arrived = true, onViewChange,
}) {
  const [stage, setStage] = useState("idle");
  const [draft, setDraft] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [focusedAnchorId, focusAnchor] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [info, setInfo] = useState(null);
  const request = useRef(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const previousStage = useRef("idle");
  const infoTimer = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(infoTimer.current);
    };
  }, []);
  useEffect(() => {
    if (active && autoCompose) setStage("arriving");
    if (!active) {
      setStage("idle");
      setSelectedId(null);
      setInfo(null);
      setError("");
    }
  }, [active, autoCompose]);
  useEffect(() => {
    if (active && arrived && stage === "arriving") setStage("compose");
  }, [active, arrived, stage]);
  useEffect(() => { focusAnchor(null); }, [active, stage]);

  const cancel = useCallback(() => {
    if (busy.current) return;
    if (selectedId) onViewChange?.(true);
    setStage((current) => current === "read" ? previousStage.current : "idle");
    setSelectedId(null);
    setInfo(null);
    setError("");
  }, [selectedId, onViewChange]);
  const begin = useCallback(() => {
    if (busy.current) return;
    if (selectedId || stage === "hidden") onViewChange?.(true);
    setSelectedId(null);
    if (uncertain) { setStage("place"); return; }
    setError("");
    setStage(stage !== "hidden" && arrived ? "compose" : "arriving");
  }, [uncertain, arrived, stage, selectedId, onViewChange]);
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
  function showInfo(id, source = "hover") {
    clearTimeout(infoTimer.current);
    setInfo((current) => current?.id === id && current.source === source ? current : { id, source });
  }

  function hideInfo(id, source = "hover") {
    clearTimeout(infoTimer.current);
    infoTimer.current = setTimeout(() => {
      setInfo((current) => current?.id === id && current.source === source ? null : current);
    }, 160);
  }

  // Hiding the viewing controls never changes the shared notes.
  function hideMessages() {
    if (busy.current) return;
    onViewChange?.(true);
    clearTimeout(infoTimer.current);
    setSelectedId(null);
    setInfo(null);
    focusAnchor(null);
    setError("");
    setStage("hidden");
  }

  function backToMessages() {
    if (busy.current) return;
    onViewChange?.(true);
    setSelectedId(null);
    setInfo(null);
    setError("");
    setStage("browse");
  }

  function viewMessages() {
    if (busy.current) return;
    if (stage === "hidden") onViewChange?.(true);
    setSelectedId(null);
    setInfo(null);
    setStage("browse");
  }

  function read(id) {
    if (busy.current) return;
    if (id !== selectedId) onViewChange?.(true);
    previousStage.current = stage === "read" ? previousStage.current : stage;
    setSelectedId(id);
    setStage("read");
  }

  function continueToPlacement() {
    if (!draft.trim() || noteLength(draft) > 180) {
      setError("Write 1–180 characters before choosing a position.");
      return false;
    }
    setError("");
    setStage("place");
    return true;
  }

  return {
    stage, draft, setDraft, selected: notes.find((note) => note.id === selectedId),
    info, showInfo, hideInfo, focusedAnchorId, focusAnchor,
    pending, uncertain, error, status,
    begin, cancel, place, continueToPlacement, hideMessages, backToMessages, viewMessages, read,
    retry: () => { if (request.current) place(request.current.anchorId); },
    edit: () => { if (!busy.current && !uncertain) setStage("compose"); },
    modal: active && stage === "compose" && arrived,
  };
}
