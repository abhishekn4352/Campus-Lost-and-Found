import API from '../api/axios';

// Browser-side Web Push helpers. All functions are safe to call when push
// isn't available (they just report that).

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const flagKey = (userId) => `push:${userId}`;
const readFlag = (userId) => { try { return localStorage.getItem(flagKey(userId)) === '1'; } catch { return false; } };
const writeFlag = (userId, on) => { try { on ? localStorage.setItem(flagKey(userId), '1') : localStorage.removeItem(flagKey(userId)); } catch { /* ignore */ } };

export function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const toBase64Url = (buffer) => {
  if (!buffer) return '';
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function getPushConfig() {
  const { data } = await API.get('/push/config');
  return data; // { enabled, publicKey }
}

async function getRegistration() {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return reg ? reg.pushManager.getSubscription() : null;
}

// Gets (or creates) this browser's push subscription for the server's VAPID key.
async function ensureBrowserSubscription(reg, publicKey) {
  let sub = await reg.pushManager.getSubscription();
  // If the server's key changed since this browser subscribed, the old
  // subscription can never be used again — replace it.
  if (sub && publicKey && toBase64Url(sub.options?.applicationServerKey) !== publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
}

// User clicked "Turn on notifications".
export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  const cfg = await getPushConfig();
  if (!cfg.enabled) throw new Error('Push notifications are not set up on this server yet.');

  const permission = await Notification.requestPermission();
  if (permission === 'denied') throw new Error('Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.');
  if (permission !== 'granted') throw new Error('Permission was not granted.');

  const reg = await getRegistration();
  const sub = await ensureBrowserSubscription(reg, cfg.publicKey);
  await API.post('/push/subscribe', { subscription: sub.toJSON() });
  writeFlag(userId, true);
  return sub;
}

// User clicked "Turn off".
export async function disablePush(userId) {
  const sub = await currentSubscription();
  if (sub) {
    const { data } = await API.post('/push/unsubscribe', { endpoint: sub.endpoint });
    // Only drop the browser-level subscription if nobody else is using it
    // (another tab may be signed in as someone else).
    if (data.remaining === 0) await sub.unsubscribe();
  }
  writeFlag(userId, false);
}

// On sign-in: if this person turned notifications on earlier in this
// browser, quietly make sure the server still has their subscription.
export async function restorePush(userId) {
  if (!pushSupported() || !readFlag(userId) || Notification.permission !== 'granted') return false;
  try {
    const cfg = await getPushConfig();
    if (!cfg.enabled) return false;
    const reg = await getRegistration();
    const sub = await ensureBrowserSubscription(reg, cfg.publicKey);
    await API.post('/push/subscribe', { subscription: sub.toJSON() });
    return true;
  } catch {
    return false;
  }
}

// On sign-out: stop sending THIS person's notifications to this browser
// (a shared computer must not keep buzzing for someone who left). The
// opt-in flag is kept, so signing in again restores it automatically.
export async function detachPush() {
  if (!pushSupported()) return;
  const work = (async () => {
    const sub = await currentSubscription();
    if (!sub) return;
    const { data } = await API.post('/push/unsubscribe', { endpoint: sub.endpoint });
    if (data.remaining === 0) await sub.unsubscribe();
  })();
  // Never let a slow network hold up signing out.
  await Promise.race([work.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 2000))]);
}

export const isPushEnabledFor = (userId) => readFlag(userId);
export const sendTestPush = () => API.post('/push/test');
