const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const MAX_SUBSCRIPTIONS_PER_USER = 10;
let vapidApplied = false;

// Push is optional: without VAPID keys the feature is simply off (the UI
// hides itself) and every call below is a harmless no-op.
const isConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
const getPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

function vapidSubject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  if (process.env.EMAIL_USER) return `mailto:${process.env.EMAIL_USER}`;
  return 'mailto:admin@example.com';
}

function ensureConfigured() {
  if (!isConfigured()) return false;
  if (!vapidApplied) {
    webpush.setVapidDetails(vapidSubject(), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    vapidApplied = true;
  }
  return true;
}

const clip = (value, max) => {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// Sends one notification to every browser this person has enabled. Dead
// subscriptions (the browser reports 404/410 Gone) are removed. The payload
// deliberately carries a short summary, never message text, so nothing
// private shows on a lock screen.
async function notifyUser(userId, { title, body, url = '/', tag, urgency = 'normal' }) {
  if (!ensureConfigured()) return { sent: 0, skipped: true };
  const subs = await PushSubscription.find({ userId });
  if (subs.length === 0) return { sent: 0 };

  const payload = JSON.stringify({
    title: clip(title, 80),
    body: clip(body, 140),
    url,
    tag,
    userId: String(userId), // lets the browser tell which signed-in tab this is for
  });

  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        payload,
        { TTL: 60 * 60 * 24, urgency }
      );
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
      } else {
        console.error('Push delivery failed:', err.statusCode || '', err.message);
      }
    }
  }));
  return { sent };
}

// Fire-and-forget for request handlers: a push problem must never fail the
// action that triggered it (sending a message, filing a claim…).
function notifyUserSafe(userId, notification) {
  if (!isConfigured() || !userId) return;
  notifyUser(userId, notification).catch((err) => console.error('Push notify failed:', err.message));
}

async function saveSubscription(userId, subscription, userAgent) {
  await PushSubscription.findOneAndUpdate(
    { userId, endpoint: subscription.endpoint },
    { $set: { keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }, userAgent: clip(userAgent, 300) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // Keep the table tidy: only the newest few devices per person.
  const all = await PushSubscription.find({ userId }).sort('-updatedAt').select('_id');
  if (all.length > MAX_SUBSCRIPTIONS_PER_USER) {
    await PushSubscription.deleteMany({ _id: { $in: all.slice(MAX_SUBSCRIPTIONS_PER_USER).map((s) => s._id) } });
  }
}

async function removeSubscription(userId, endpoint) {
  await PushSubscription.deleteOne({ userId, endpoint });
  return PushSubscription.countDocuments({ endpoint }); // other people still using this browser
}

module.exports = { isConfigured, getPublicKey, notifyUser, notifyUserSafe, saveSubscription, removeSubscription };
