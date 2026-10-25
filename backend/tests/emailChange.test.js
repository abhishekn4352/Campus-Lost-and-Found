jest.mock('../models/User');
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('fake.jwt') }));
jest.mock('../utils/sendOTP', () => ({
  sendOTPEmail: jest.fn().mockResolvedValue(true),
  sendEmailChangedNotice: jest.fn().mockResolvedValue(true),
}));

const User = require('../models/User');
const { sendOTPEmail, sendEmailChangedNotice } = require('../utils/sendOTP');
const { requestEmailChange, confirmEmailChange } = require('../controllers/authController');

const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const baseUser = (over = {}) => ({
  _id: 'u1', name: 'Riya', email: 'old@college.edu', role: 'student',
  matchPassword: jest.fn().mockResolvedValue(true), save: jest.fn().mockResolvedValue(true), ...over,
});
const requestChange = (user, body) => {
  User.findById.mockResolvedValue(user);
  const res = mockRes();
  return requestEmailChange({ user: { _id: 'u1' }, body }, res).then(() => res);
};
const confirm = (user, body) => {
  User.findById.mockResolvedValue(user);
  const res = mockRes();
  return confirmEmailChange({ user: { _id: 'u1' }, body }, res).then(() => res);
};

beforeEach(() => { jest.clearAllMocks(); User.exists.mockResolvedValue(null); });

describe('requestEmailChange (step 1)', () => {
  test('mails a code to the NEW address and stores it as pending — the current email is not touched yet', async () => {
    const user = baseUser();
    const res = await requestChange(user, { newEmail: '  New@College.edu ', password: 'secret123' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@college.edu' }));
    expect(user.email).toBe('old@college.edu');
    expect(user.pendingEmail).toBe('new@college.edu');
    expect(user.pendingEmailOtp).toMatch(/^\d{6}$/);
    expect(sendOTPEmail).toHaveBeenCalledWith('new@college.edu', 'Riya', user.pendingEmailOtp, expect.stringMatching(/new email/));
  });

  test('requires the correct current password', async () => {
    const user = baseUser({ matchPassword: jest.fn().mockResolvedValue(false) });
    const res = await requestChange(user, { newEmail: 'new@college.edu', password: 'wrong' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sendOTPEmail).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  test('rejects an invalid address, the same address, and an address another account uses', async () => {
    let res = await requestChange(baseUser(), { newEmail: 'nope', password: 'x' });
    expect(res.status).toHaveBeenCalledWith(400);
    res = await requestChange(baseUser(), { newEmail: 'OLD@college.edu', password: 'x' });
    expect(res.status).toHaveBeenCalledWith(400);
    User.exists.mockResolvedValue({ _id: 'someone' });
    res = await requestChange(baseUser(), { newEmail: 'taken@college.edu', password: 'x' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(sendOTPEmail).not.toHaveBeenCalled();
  });

  test('refuses object-valued input (NoSQL-injection style)', async () => {
    const res = await requestChange(baseUser(), { newEmail: { $ne: '' }, password: 'x' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('throttles a second request within 30 seconds', async () => {
    const user = baseUser({ pendingEmailExpiresAt: new Date(Date.now() + 9.9 * 60 * 1000) });
    const res = await requestChange(user, { newEmail: 'new@college.edu', password: 'x' });
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('confirmEmailChange (step 2)', () => {
  const pendingUser = (over = {}) => baseUser({
    pendingEmail: 'new@college.edu', pendingEmailOtp: '123456', pendingEmailAttempts: 0,
    pendingEmailExpiresAt: new Date(Date.now() + 60000), ...over,
  });

  test('the right code swaps the email, clears the pending fields and warns the OLD address', async () => {
    const user = pendingUser();
    const res = await confirm(user, { otp: '123456' });
    expect(user.email).toBe('new@college.edu');
    expect(user.pendingEmail).toBeUndefined();
    expect(user.pendingEmailOtp).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
    expect(sendEmailChangedNotice).toHaveBeenCalledWith('old@college.edu', 'Riya', 'new@college.edu');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ email: 'new@college.edu' }) }));
    // the response must not leak the code or pending fields
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('123456');
  });

  test('a wrong code is rejected and counted; the email is unchanged', async () => {
    const user = pendingUser();
    const res = await confirm(user, { otp: '000000' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(user.email).toBe('old@college.edu');
    expect(User.updateOne).toHaveBeenCalledWith({ _id: 'u1' }, { $set: { pendingEmailAttempts: 1 } });
  });

  test('the 5th wrong guess destroys the code', async () => {
    const user = pendingUser({ pendingEmailAttempts: 4 });
    await confirm(user, { otp: '000000' });
    expect(User.updateOne).toHaveBeenCalledWith({ _id: 'u1' }, expect.objectContaining({ $unset: { pendingEmailOtp: 1, pendingEmailExpiresAt: 1 } }));
  });

  test('an expired code is rejected', async () => {
    const user = pendingUser({ pendingEmailExpiresAt: new Date(Date.now() - 1000) });
    const res = await confirm(user, { otp: '123456' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(user.email).toBe('old@college.edu');
  });

  test('nothing to confirm when no change was requested', async () => {
    const res = await confirm(baseUser(), { otp: '123456' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('if the address got taken in the meantime the swap is refused (409)', async () => {
    const user = pendingUser();
    User.exists.mockResolvedValue({ _id: 'other' });
    const res = await confirm(user, { otp: '123456' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(user.email).toBe('old@college.edu');
  });

  test('clears an abandoned never-verified sign-up that held the address', async () => {
    await confirm(pendingUser(), { otp: '123456' });
    expect(User.deleteMany).toHaveBeenCalledWith({ email: 'new@college.edu', isVerified: false, _id: { $ne: 'u1' } });
  });
});
