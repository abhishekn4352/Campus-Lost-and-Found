jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));
jest.mock('../models/PushSubscription');
jest.mock('../models/User');
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(), verify: jest.fn(() => ({ id: 'u1' })) }));

const request = require('supertest');
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');
const push = require('../services/pushService');

const KEYS = { VAPID_PUBLIC_KEY: 'pub-key', VAPID_PRIVATE_KEY: 'priv-key', VAPID_SUBJECT: 'mailto:admin@college.edu' };
const setVapid = () => Object.assign(process.env, KEYS);
const clearVapid = () => Object.keys(KEYS).forEach((k) => delete process.env[k]);

const sub = (id, endpoint = `https://push.example/${id}`) => ({ _id: id, endpoint, keys: { p256dh: 'p', auth: 'a' } });

beforeEach(() => {
  jest.clearAllMocks();
  clearVapid();
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'u1', name: 'Riya', isActive: true, lastActive: new Date() }) });
  User.updateOne.mockReturnValue({ catch: () => {} });
});
afterAll(clearVapid);

describe('pushService.notifyUser', () => {
  test('is a harmless no-op when VAPID keys are not configured', async () => {
    const out = await push.notifyUser('u1', { title: 't', body: 'b' });
    expect(out).toEqual({ sent: 0, skipped: true });
    expect(PushSubscription.find).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  test('sends to every device of that user, with the recipient id in the payload', async () => {
    setVapid();
    PushSubscription.find.mockResolvedValue([sub('s1'), sub('s2')]);
    webpush.sendNotification.mockResolvedValue({});
    const out = await push.notifyUser('u1', { title: 'New message', body: 'Aman wrote to you', url: '/messages/c1', tag: 'msg-c1' });
    expect(out.sent).toBe(2);
    expect(webpush.setVapidDetails).toHaveBeenCalledWith('mailto:admin@college.edu', 'pub-key', 'priv-key');
    const [target, payload, options] = webpush.sendNotification.mock.calls[0];
    expect(target.endpoint).toMatch(/^https:\/\/push\.example\//);
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({ title: 'New message', url: '/messages/c1', userId: 'u1', tag: 'msg-c1' });
    expect(options.TTL).toBeGreaterThan(0);
  });

  test('removes subscriptions the browser reports as gone (404/410) and keeps going', async () => {
    setVapid();
    PushSubscription.find.mockResolvedValue([sub('dead'), sub('alive')]);
    webpush.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({});
    const out = await push.notifyUser('u1', { title: 't', body: 'b' });
    expect(out.sent).toBe(1);
    expect(PushSubscription.deleteOne).toHaveBeenCalledWith({ _id: 'dead' });
  });

  test('a temporary push-service error does not delete the subscription', async () => {
    setVapid();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    PushSubscription.find.mockResolvedValue([sub('s1')]);
    webpush.sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 503 }));
    await push.notifyUser('u1', { title: 't', body: 'b' });
    expect(PushSubscription.deleteOne).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('long titles/bodies are clipped to stay far below the 4 KB payload limit', async () => {
    setVapid();
    PushSubscription.find.mockResolvedValue([sub('s1')]);
    webpush.sendNotification.mockResolvedValue({});
    await push.notifyUser('u1', { title: 'T'.repeat(500), body: 'B'.repeat(2000) });
    const parsed = JSON.parse(webpush.sendNotification.mock.calls[0][1]);
    expect(parsed.title.length).toBeLessThanOrEqual(80);
    expect(parsed.body.length).toBeLessThanOrEqual(140);
  });

  test('notifyUserSafe never throws, even when sending fails', async () => {
    setVapid();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    PushSubscription.find.mockRejectedValue(new Error('db down'));
    expect(() => push.notifyUserSafe('u1', { title: 't', body: 'b' })).not.toThrow();
    await new Promise((r) => setImmediate(r));
    spy.mockRestore();
  });
});

describe('pushService subscriptions', () => {
  test('saving upserts per (user, endpoint) and prunes beyond 10 devices', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ _id: `s${i}` }));
    PushSubscription.find.mockReturnValue({ sort: () => ({ select: () => Promise.resolve(rows) }) });
    await push.saveSubscription('u1', { endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' } }, 'UA');
    expect(PushSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1', endpoint: 'https://push.example/x' }, expect.anything(), expect.objectContaining({ upsert: true })
    );
    expect(PushSubscription.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['s10', 's11'] } });
  });

  test('removing reports how many OTHER people still use that browser endpoint', async () => {
    PushSubscription.countDocuments.mockResolvedValue(1);
    const remaining = await push.removeSubscription('u1', 'https://push.example/x');
    expect(PushSubscription.deleteOne).toHaveBeenCalledWith({ userId: 'u1', endpoint: 'https://push.example/x' });
    expect(remaining).toBe(1);
  });
});

describe('/api/push routes', () => {
  const app = require('../app');
  const auth = { Authorization: 'Bearer anything' };
  const goodSub = { endpoint: 'https://fcm.example/abc', keys: { p256dh: 'pp', auth: 'aa' } };

  test('GET /config is public and reports whether push is enabled', async () => {
    let res = await request(app).get('/api/push/config');
    expect(res.body).toEqual({ enabled: false, publicKey: null });
    setVapid();
    res = await request(app).get('/api/push/config');
    expect(res.body).toEqual({ enabled: true, publicKey: 'pub-key' });
  });

  test('subscribe requires a signed-in user', async () => {
    const res = await request(app).post('/api/push/subscribe').send({ subscription: goodSub });
    expect(res.status).toBe(401);
  });

  test('subscribe returns 503 when push is not configured', async () => {
    const res = await request(app).post('/api/push/subscribe').set(auth).send({ subscription: goodSub });
    expect(res.status).toBe(503);
  });

  test('subscribe rejects malformed or non-https subscriptions', async () => {
    setVapid();
    for (const bad of [{}, { endpoint: 'http://insecure/x', keys: { p256dh: 'p', auth: 'a' } }, { endpoint: 'https://x', keys: {} }, { endpoint: { $gt: '' }, keys: { p256dh: 'p', auth: 'a' } }]) {
      const res = await request(app).post('/api/push/subscribe').set(auth).send({ subscription: bad });
      expect(res.status).toBe(400);
    }
    expect(PushSubscription.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('subscribe stores a valid subscription for the signed-in user', async () => {
    setVapid();
    PushSubscription.find.mockReturnValue({ sort: () => ({ select: () => Promise.resolve([]) }) });
    const res = await request(app).post('/api/push/subscribe').set(auth).send({ subscription: goodSub });
    expect(res.status).toBe(201);
    expect(PushSubscription.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1', endpoint: 'https://fcm.example/abc' }, expect.anything(), expect.anything()
    );
  });

  test('unsubscribe returns how many others remain on that browser', async () => {
    PushSubscription.countDocuments.mockResolvedValue(0);
    const res = await request(app).post('/api/push/unsubscribe').set(auth).send({ endpoint: 'https://fcm.example/abc' });
    expect(res.body).toEqual({ ok: true, remaining: 0 });
  });

  test('test notification: 404 when this user has no enabled device', async () => {
    setVapid();
    PushSubscription.find.mockResolvedValue([]);
    const res = await request(app).post('/api/push/test').set(auth);
    expect(res.status).toBe(404);
  });

  test('test notification: delivers to the user’s device', async () => {
    setVapid();
    PushSubscription.find.mockResolvedValue([sub('s1')]);
    webpush.sendNotification.mockResolvedValue({});
    const res = await request(app).post('/api/push/test').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
  });
});
