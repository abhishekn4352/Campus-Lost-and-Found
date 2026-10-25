// Per-TAB session token.
//
// sessionStorage is private to a single browser tab (a new tab starts empty),
// which is what lets two tabs be signed in as two different people at the
// same time. If storage is blocked (some privacy modes) we fall back to a
// plain variable, which gives the same per-tab behaviour until reload.
const KEY = 'lf_session_token';
let memoryToken = null;

export function getToken() {
  try {
    return sessionStorage.getItem(KEY) || memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token) {
  memoryToken = token;
  try { sessionStorage.setItem(KEY, token); } catch { /* memory fallback */ }
}

export function clearToken() {
  memoryToken = null;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
