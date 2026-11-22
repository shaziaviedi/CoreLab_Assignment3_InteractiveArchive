// Leading/trailing throttle: the latest complete profile wins during rapid edits.
export function createPresencePublisher(send, interval = 500, now = Date.now) {
  let lastSent = -Infinity, lastKey = null, pending = null, timer = null;
  function flush() {
    timer = null;
    if (!pending) return;
    const snapshot = pending;
    pending = null;
    lastSent = now();
    lastKey = JSON.stringify(snapshot);
    send(snapshot);
  }
  return {
    publish(snapshot, force = false) {
      if (!force && JSON.stringify(snapshot) === lastKey) {
        pending = null;
        clearTimeout(timer);
        timer = null;
        return;
      }
      pending = snapshot;
      const remaining = interval - (now() - lastSent);
      if (remaining <= 0) { clearTimeout(timer); flush(); }
      else if (!timer) timer = setTimeout(flush, remaining);
    },
    cancel() {
      clearTimeout(timer);
      timer = null;
      pending = null;
      lastKey = null;
      lastSent = -Infinity;
    },
  };
}
