import { useCallback, useEffect, useRef, useState } from "react";

export default function usePoolFlowers({ active, side, flowers, createFlower, status }) {
  const [roseColor, setRoseColor] = useState("white");
  const [previewId, setPreviewId] = useState(null);
  const [info, setInfo] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const requests = useRef(new Map());
  const mounted = useRef(true);
  const currentFlowers = useRef(flowers);
  currentFlowers.current = flowers;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setPreviewId(null);
    setInfo(null);
    setError("");
  }, [active, side]);
  const showInfo = useCallback((anchorId, source = "hover") => {
    setInfo((previous) => {
      // Compatibility mouse events must not unpin a touch label, and hovering
      // must not hide attribution belonging to the current keyboard focus.
      if (source === "hover" && (previous?.source === "focus" ||
        (previous?.source === "tap" && previous.anchorId === anchorId))) return previous;
      return previous?.anchorId === anchorId && previous.source === source
        ? previous : { anchorId, source };
    });
  }, []);
  const hideInfo = useCallback((anchorId, source = "hover") => {
    setInfo((previous) => previous?.anchorId === anchorId && previous.source === source ? null : previous);
  }, []);
  const dismissInfo = useCallback(() => setInfo(null), []);
  const preview = useCallback((anchorId) => {
    if (active && !busy.current && status === "connected") setPreviewId(anchorId);
  }, [active, status]);
  const clearPreview = useCallback((anchorId) => {
    setPreviewId((current) => !anchorId || current === anchorId ? null : current);
  }, []);
  const place = useCallback(async (anchor) => {
    if (!active || busy.current || anchor.poolSide !== side) return;
    if (currentFlowers.current.some((flower) => flower.anchorId === anchor.id)) return;
    setPreviewId(null);
    if (status !== "connected") { setError("Reconnect before leaving a flower."); return; }
    // An uncertain request keeps its ID per anchor. Choosing another anchor is
    // a separate deliberate gesture; double-clicks cannot start a second request.
    if (!requests.current.has(anchor.id)) requests.current.set(anchor.id, {
      requestId: crypto.randomUUID(), poolSide: anchor.poolSide, anchorId: anchor.id, roseColor,
    });
    // Retry the complete original payload, including its color, after a lost ack.
    const payload = requests.current.get(anchor.id);
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await createFlower(payload);
      if (!mounted.current) return;
      if (result.ok) requests.current.delete(anchor.id);
      else {
        setError(result.error?.message || "This position is unavailable. Please choose another.");
        if (!["ACK_TIMEOUT", "INVALID_REPLY", "DISCONNECTED"].includes(result.error?.code))
          requests.current.delete(anchor.id);
      }
    } catch {
      if (mounted.current) setError("Connection interrupted. Please try again.");
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, [active, side, status, createFlower, roseColor]);
  return { roseColor, setRoseColor, previewId, info, pending, error, preview, clearPreview, place, showInfo, hideInfo, dismissInfo };
}
