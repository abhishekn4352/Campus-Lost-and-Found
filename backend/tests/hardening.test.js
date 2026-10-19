jest.mock('../models/User');
jest.mock('../models/Item');
jest.mock('../models/Claim');
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('fake.jwt') }));
jest.mock('../utils/sendOTP', () => ({ sendOTPEmail: jest.fn().mockResolvedValue(true), sendMessageEmail: jest.fn() }));

const User = require('../models/User');
const Item = require('../models/Item');
const { sendOTPEmail } = require('../utils/sendOTP');
const { requestOTP, loginWithOTP, changePassword } = require('../controllers/authController');
const { createItem, getItems } = require('../controllers/itemController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('OTP hardening', () => {
  test('login/reset OTP for an unknown email creates no account, sends nothing, and answers like a success (no enumeration)', async () => {
    User.findOne.mockResolvedValue(null);
    const res = mockRes();
    await requestOTP({ body: { email: 'nobody@college.edu' } }, res);
    expect(User).not.toHaveBeenCalled();
    expect(sendOTPEmail).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('a second code requested within 30 seconds is refused (429)', async () => {
    User.findOne.mockResolvedValue({
      isVerified: true, otp: '123456', otpExpiresAt: new Date(Date.now() + 9.9 * 60 * 1000), save: jest.fn(),
    });
    const res = mockRes();
    await requestOTP({ body: { email: 'riya@college.edu' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(sendOTPEmail).not.toHaveBeenCalled();
  });

  test('after 5 wrong guesses even the CORRECT code is rejected', async () => {
    User.findOne.mockResolvedValue({
      _id: 'u1', isVerified: true, otp: '111222', otpAttempts: 5,
      otpExpiresAt: new Date(Date.now() + 60000), save: jest.fn(),
    });
    const res = mockRes();
    await loginWithOTP({ body: { email: 'riya@college.edu', otp: '111222' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  test('a wrong guess is counted, and the 5th one destroys the code', async () => {
    User.findOne.mockResolvedValue({
      _id: 'u1', isVerified: true, otp: '111222', otpAttempts: 4,
      otpExpiresAt: new Date(Date.now() + 60000), save: jest.fn(),
    });
    await loginWithOTP({ body: { email: 'riya@college.edu', otp: '000000' } }, mockRes());
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      expect.objectContaining({ $set: { otpAttempts: 5 }, $unset: { otp: 1, otpExpiresAt: 1 } })
    );
  });

  test('object-valued credentials (NoSQL-injection attempt) are rejected, not queried', async () => {
    const res = mockRes();
    await loginWithOTP({ body: { email: { $gt: '' }, otp: '123456' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findOne).not.toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  test('refuses when the current password is wrong', async () => {
    User.findById.mockResolvedValue({ matchPassword: jest.fn().mockResolvedValue(false), save: jest.fn() });
    const res = mockRes();
    await changePassword({ user: { _id: 'u1' }, body: { currentPassword: 'wrong-pass', newPassword: 'brand-new-pass' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('saves the new password when the current one is right', async () => {
    const user = { matchPassword: jest.fn().mockResolvedValue(true), save: jest.fn().mockResolvedValue(true) };
    User.findById.mockResolvedValue(user);
    const res = mockRes();
    await changePassword({ user: { _id: 'u1' }, body: { currentPassword: 'old-password', newPassword: 'brand-new-pass' } }, res);
    expect(user.password).toBe('brand-new-pass');
    expect(user.save).toHaveBeenCalled();
  });

  test('rejects a too-short new password', async () => {
    const res = mockRes();
    await changePassword({ user: { _id: 'u1' }, body: { currentPassword: 'old-password', newPassword: 'short' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('createItem validation', () => {
  const validBody = {
    type: 'found', title: 'Black umbrella', description: 'Left in the library, has a wooden handle.',
    category: 'Other', location: 'Library', lostFoundDate: new Date().toISOString(),
  };
  const run = async (body) => {
    Item.create.mockResolvedValue({ _id: 'i1' });
    const res = mockRes();
    await createItem({ user: { _id: 'u1' }, body }, res);
    return res;
  };

  test('accepts a valid post', async () => {
    const res = await run(validBody);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test.each([
    ['unknown type', { type: 'stolen' }],
    ['too-short title', { title: 'ab' }],
    ['too-short description', { description: 'short' }],
    ['unknown category', { category: 'Weapons' }],
    ['date far in the future', { lostFoundDate: new Date(Date.now() + 5 * 86400000).toISOString() }],
    ['garbage date', { lostFoundDate: 'not-a-date' }],
    ['missing location', { location: '   ' }],
  ])('rejects %s with 400 and never touches the database', async (_label, patch) => {
    const res = await run({ ...validBody, ...patch });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Item.create).not.toHaveBeenCalled();
  });
});

describe('getItems — public listing', () => {
  const chain = (items) => {
    const q = { populate: jest.fn(() => q), sort: jest.fn(() => q), skip: jest.fn(() => q), limit: jest.fn().mockResolvedValue(items) };
    return q;
  };

  test('only exposes the poster\'s name (never email/phone) and returns pagination metadata', async () => {
    const q = chain([{ _id: 'i1' }]);
    Item.find.mockReturnValue(q);
    Item.countDocuments.mockResolvedValue(30);
    const res = mockRes();
    await getItems({ query: { page: '2', limit: '12' } }, res);

    expect(q.populate).toHaveBeenCalledWith('postedBy', 'name');
    expect(q.skip).toHaveBeenCalledWith(12);
    expect(q.limit).toHaveBeenCalledWith(12);
    expect(res.json).toHaveBeenCalledWith({ items: [{ _id: 'i1' }], total: 30, page: 2, pages: 3 });
  });

  test('combines search text with type/category filters (previously filters were dropped while searching)', async () => {
    Item.find.mockReturnValue(chain([]));
    Item.countDocuments.mockResolvedValue(0);
    await getItems({ query: { q: 'wallet', type: 'found', category: 'Wallet' } }, mockRes());
    const filter = Item.find.mock.calls[0][0];
    const flat = JSON.stringify(filter);
    expect(flat).toContain('"type":"found"');
    expect(flat).toContain('"category":"Wallet"');
    expect(flat).toMatch(/wallet/i);
  });

  test('caps the page size', async () => {
    const q = chain([]);
    Item.find.mockReturnValue(q);
    Item.countDocuments.mockResolvedValue(0);
    await getItems({ query: { limit: '5000' } }, mockRes());
    expect(q.limit).toHaveBeenCalledWith(48);
  });

  test('ignores a regex-injection attempt in the search text', async () => {
    Item.find.mockReturnValue(chain([]));
    Item.countDocuments.mockResolvedValue(0);
    await expect(getItems({ query: { q: '(((' } }, mockRes())).resolves.not.toThrow();
  });
});
