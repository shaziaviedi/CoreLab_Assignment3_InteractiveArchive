import React, { useEffect, useState } from "react";

export default function CollaborationNotice({ announcement, enabled }) {
  const [visible, setVisible] = useState(null);
  useEffect(() => {
    if (!enabled || !announcement || Date.now() >= announcement.expiresAt) { setVisible(null); return; }
    setVisible(announcement);
    const timer = setTimeout(() => setVisible(null), Math.max(0, announcement.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [announcement, enabled]);
  return visible && <div className="collaboration-notice" role="status" aria-live="polite">{visible.text}</div>;
}
