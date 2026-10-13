const request = require('supertest');

// Ensure a JWT secret exists so authMiddleware's jwt.verify doesn't throw
// a config error before it can return the expected 401.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const app = require('../app');

describe('app smoke tests (no live MongoDB required)', () => {
  test('protected item route rejects requests with no auth token', async () => {
    const res = await request(app).get('/api/items/my-posts');
    expect(res.status).toBe(401);
  });

  test('protected message route rejects requests with no auth token', async () => {
    const res = await request(app).get('/api/messages/conversations');
    expect(res.status).toBe(401);
  });

  test('admin route rejects requests with no auth token', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  test('an invalid/garbage auth token is rejected, not crashed', async () => {
    const res = await request(app)
      .get('/api/items/my-posts')
      .set('Cookie', ['token=not-a-real-jwt']);
    expect(res.status).toBe(401);
  });

  test('unknown route returns a clean 404 JSON error via the global handler', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  test('a disallowed CORS origin gets a clean 403, not a 500 (regression test — found live)', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('Origin', 'http://evil-site.com');
    // Before the fix: the CORS error had no statusCode, so it fell
    // through the error handler's default branch and returned 500.
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not allowed by cors/i);
  });

  test('error responses never include a stack trace when NODE_ENV is unset (regression test — found live)', async () => {
    const originalEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const res = await request(app)
        .get('/api/items')
        .set('Origin', 'http://evil-site.com');
      // Before the fix, `NODE_ENV !== 'production'` was true whenever
      // NODE_ENV was simply unset (a very easy real-world misconfiguration),
      // which leaked the full server-side stack trace — including
      // absolute file paths — to any client. Verified live via curl.
      expect(res.body).not.toHaveProperty('stack');
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;
    }
  });

  test('error responses DO include a stack trace when NODE_ENV=development (local debugging still works)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const res = await request(app)
        .get('/api/items')
        .set('Origin', 'http://evil-site.com');
      expect(res.body).toHaveProperty('stack');
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;
    }
  });

  // NOTE: an end-to-end "/items/search?q=(" test against the real route is
  // intentionally NOT included here — without a live MongoDB connection,
  // Mongoose buffers the query indefinitely instead of failing fast,
  // which would make this suite hang/timeout rather than give a
  // meaningful pass/fail. That regex-safety behavior is covered directly
  // in escapeRegex.test.js (unit-level) instead, which is the accurate,
  // fast, DB-independent way to verify it in this environment.
});
