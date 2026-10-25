/* Campus Lost & Found — service worker.
 *
 * Does ONE job: show Web Push notifications. It does not cache anything, so
 * there is no stale-asset risk and nothing to invalidate on deploy.
 *
 * Several tabs of the same browser can be signed in as DIFFERENT people (each
 * tab keeps its own session), and a browser has just one push endpoint. So the
 * server tags every push with the recipient's user id and this worker asks
 * the open tabs "who are you / are you looking?" before deciding what to do.
 */
const ASK_TIMEOUT_MS = 500;

// Ask every open tab a question over a private MessageChannel and collect
// the answers (tabs that don't answer in time count as "no answer").
async function askClients(message) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return Promise.all(windows.map((client) => new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve({ client, reply: null }), ASK_TIMEOUT_MS);
    channel.port1.onmessage = (event) => { clearTimeout(timer); resolve({ client, reply: event.data }); };
    try {
      client.postMessage(message, [channel.port2]);
    } catch (err) {
      clearTimeout(timer);
      resolve({ client, reply: null });
    }
  })));
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'Campus Lost & Found', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil((async () => {
    // If a visible tab is already signed in as THIS recipient, the in-app
    // badges/toasts cover it — don't also pop a system notification.
    const answers = await askClients({ type: 'push-check' });
    const alreadyLooking = answers.some(({ reply }) => reply && reply.visible && data.userId && reply.userId === data.userId);
    if (alreadyLooking) return;

    await self.registration.showNotification(data.title || 'Campus Lost & Found', {
      body: data.body || '',
      icon: '/icon-192.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || '/', userId: data.userId || null },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url = '/', userId = null } = event.notification.data || {};

  event.waitUntil((async () => {
    // Prefer the tab that belongs to the person this notification is for.
    const answers = await askClients({ type: 'who-are-you' });
    const match = userId ? answers.find(({ reply }) => reply && reply.userId === userId) : null;
    if (match) {
      await match.client.focus();
      match.client.postMessage({ type: 'navigate', url });
      return;
    }
    // No tab for them: open a new one (it will ask them to sign in, then
    // come back to this page).
    await self.clients.openWindow(url);
  })());
});
