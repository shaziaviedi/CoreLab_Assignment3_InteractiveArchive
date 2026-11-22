import { RequestError } from "../validation.js";

// Allow small legitimate bursts, while bounding broadcasts from a noisy socket.
export class PresenceLimiter {
  constructor(now = Date.now) { this.now = now; this.start = 0; this.count = 0; }
  consume() {
    const now = this.now();
    if (now >= this.start + 1000) { this.start = now; this.count = 0; }
    if (this.count >= 6)
      throw new RequestError("PRESENCE_RATE_LIMITED", "Please wait before updating your presence.", { retryAfterMs: this.start + 1000 - now });
    this.count++;
  }
}
