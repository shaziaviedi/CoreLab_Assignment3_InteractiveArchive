import React, { useEffect, useRef, useState } from "react";
import { memorialRoomUrl } from "../presence/roomLink.js";

export default function RoomShare({ roomId }) {
  const [feedback, setFeedback] = useState("");
  const [fallback, setFallback] = useState("");
  const input = useRef(null);
  useEffect(() => {
    if (fallback) { input.current?.focus(); input.current?.select(); }
  }, [fallback]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);
  async function copy() {
    const url = memorialRoomUrl(window.location.href, roomId);
    try {
      await navigator.clipboard.writeText(url);
      setFallback("");
      setFeedback("Room link copied.");
    } catch {
      setFallback(url);
      setFeedback("Select and copy this room link.");
    }
  }
  return (
    <div className="room-share">
      <button onClick={copy} disabled={!roomId}>Copy room link</button>
      {fallback && <input ref={input} aria-label="Memorial room URL" value={fallback} readOnly onFocus={(event) => event.currentTarget.select()} />}
      {feedback && <small role="status">{feedback}</small>}
    </div>
  );
}
