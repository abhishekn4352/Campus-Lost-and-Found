const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { isString, fail } = require('../utils/validators');
const push = require('../services/pushService');

// Tells the website whether push is available and which key to subscribe
// with. Public: it contains nothing secret (the public VAPID key is meant
// to be shared).
router.get('/config', (req, res) => {
  res.json({ enabled: push.isConfigured(), publicKey: push.getPublicKey() });
});

router.use(protect);

router.post('/subscribe', asyncHandler(async (req, res) => {
  if (!push.isConfigured()) return fail(res, 503, 'Push notifications are not enabled on this server.');
  const sub = req.body?.subscription;
  const ok = sub && isString(sub.endpoint) && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length <= 2048
    && isString(sub.keys?.p256dh) && isString(sub.keys?.auth);
  if (!ok) return fail(res, 400, 'That does not look like a valid push subscription.');
  await push.saveSubscription(req.user._id, sub, req.headers['user-agent']);
  res.status(201).json({ ok: true });
}));

router.post('/unsubscribe', asyncHandler(async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!isString(endpoint) || !endpoint) return fail(res, 400, 'endpoint is required.');
  const remaining = await push.removeSubscription(req.user._id, endpoint);
  res.json({ ok: true, remaining });
}));

// "Send me a test notification" button on the profile page.
router.post('/test', asyncHandler(async (req, res) => {
  if (!push.isConfigured()) return fail(res, 503, 'Push notifications are not enabled on this server.');
  const { sent } = await push.notifyUser(req.user._id, {
    title: 'Notifications are on',
    body: 'You’ll be alerted here about messages and claims.',
    url: '/dashboard',
    tag: 'test',
  });
  if (sent === 0) return fail(res, 404, 'No enabled device found. Turn notifications on first.');
  res.json({ ok: true, sent });
}));

module.exports = router;
