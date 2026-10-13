// A minimal pub/sub so api/axios.js (a plain module outside React) can
// tell AuthContext "the session is no longer valid" without the two
// needing a direct import cycle. Backed by a real DOM EventTarget rather
// than a hand-rolled array, so listener add/remove semantics are correct
// for free.
const bus = new EventTarget();
export const SESSION_EXPIRED = 'session-expired';

export function emitSessionExpired() {
  bus.dispatchEvent(new Event(SESSION_EXPIRED));
}

export function onSessionExpired(handler) {
  bus.addEventListener(SESSION_EXPIRED, handler);
  return () => bus.removeEventListener(SESSION_EXPIRED, handler);
}
