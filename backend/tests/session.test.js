jest.mock('../models/User');
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token) => {
    if (token === 'token-for-riya') return { id: 'riya' };
    if (token === 'token-for-aman') return { id: 'aman' };
    throw new Error('bad token');
  }),
}));

const User = require('../models/User');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

const run = async (mw, req) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await mw({ headers: {}, ...req }, res, next);
  return { res, next };
};

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockImplementation((id) => ({
    select: jest.fn().mockResolvedValue({ _id: id, name: id, isActive: true, lastActive: new Date() }),
  }));
  User.updateOne.mockReturnValue({ catch: () => {} });
});

describe('per-tab sessions (Bearer token only)', () => {
  test('a cookie alone does NOT authenticate — otherwise every tab would share one login', async () => {
    const req = { cookies: { token: 'token-for-riya' }, headers: { cookie: 'token=token-for-riya' } };
    const { res, next } = await run(protect, req);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('two requests carrying different tokens resolve to two different users (two accounts, one browser)', async () => {
    const a = { headers: { authorization: 'Bearer token-for-riya' } };
    const b = { headers: { authorization: 'Bearer token-for-aman' } };
    await run(protect, a);
    await run(protect, b);
    // protect() mutates the request object it is given
    const reqA = { headers: a.headers }; const reqB = { headers: b.headers };
    const resA = await run(protect, reqA); const resB = await run(protect, reqB);
    expect(resA.next).toHaveBeenCalled();
    expect(resB.next).toHaveBeenCalled();
    expect(User.findById).toHaveBeenCalledWith('riya');
    expect(User.findById).toHaveBeenCalledWith('aman');
  });

  test('an invalid token is rejected with 401', async () => {
    const { res, next } = await run(protect, { headers: { authorization: 'Bearer nonsense' } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('a suspended account is rejected with 403 even with a valid token', async () => {
    User.findById.mockImplementation(() => ({ select: jest.fn().mockResolvedValue({ _id: 'riya', isActive: false }) }));
    const { res } = await run(protect, { headers: { authorization: 'Bearer token-for-riya' } });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('optionalAuth treats a cookie-only request as anonymous', async () => {
    const req = { headers: {}, cookies: { token: 'token-for-riya' } };
    const { next } = await run(optionalAuth, req);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
