jest.mock('../models/User');
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('fake.jwt.token') }));
jest.mock('../utils/sendOTP', () => ({
  sendOTPEmail: jest.fn().mockResolvedValue(true),
  sendMessageEmail: jest.fn().mockResolvedValue(true),
}));

const User = require('../models/User');
const { sendOTPEmail } = require('../utils/sendOTP');
const { register, requestOTP, loginWithOTP, updateProfile } = require('../controllers/authController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
}

describe('authController.requestOTP (regression test for the missing-phone crash)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates a placeholder user with every schema-required field populated', async () => {
    User.findOne.mockResolvedValue(null);
    const constructedDocs = [];
    User.mockImplementation(function (data) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(true);
      constructedDocs.push(this);
    });

    const req = { body: { email: 'brandnew@college.edu', purpose: 'register' } };
    const res = mockRes();

    await requestOTP(req, res);

    expect(constructedDocs).toHaveLength(1);
    const placeholder = constructedDocs[0];
    // Every field the User schema marks required: true must be present
    // AND non-empty — Mongoose's required validator for a String field
    // rejects '' the same as null/undefined (confirmed against the real
    // schema in tests/userSchemaValidation.test.js). Checking the exact
    // value here, not just "is a string", is what would have caught the
    // earlier phone: '' regression that a looser assertion missed.
    expect(placeholder.name).toBe('New User');
    expect(placeholder.password).toEqual(expect.any(String));
    expect(placeholder.password.length).toBeGreaterThan(0);
    expect(placeholder.phone).toBe('PENDING');
    expect(placeholder.collegeId).toBe('PENDING');
    expect(placeholder.save).toHaveBeenCalled();
    expect(sendOTPEmail).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/OTP sent/i) }));
  });

  test('normalizes email (trim + lowercase) before lookup and save', async () => {
    User.findOne.mockResolvedValue(null);
    User.mockImplementation(function (data) { Object.assign(this, data); this.save = jest.fn().mockResolvedValue(true); });

    const req = { body: { email: '  Student@College.EDU  ', purpose: 'register' } };
    const res = mockRes();
    await requestOTP(req, res);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'student@college.edu' });
  });

  test('purpose="register" against an already-verified account returns 409 without sending an OTP', async () => {
    User.findOne.mockResolvedValue({ email: 'existing@college.edu', isVerified: true });

    const req = { body: { email: 'existing@college.edu', purpose: 'register' } };
    const res = mockRes();
    await requestOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(sendOTPEmail).not.toHaveBeenCalled();
  });

  test('plain login-otp request (no purpose) still sends an OTP to an existing verified account', async () => {
    const existing = { email: 'existing2@college.edu', isVerified: true, name: 'Riya', save: jest.fn().mockResolvedValue(true) };
    User.findOne.mockResolvedValue(existing);

    const req = { body: { email: 'existing2@college.edu' } };
    const res = mockRes();
    await requestOTP(req, res);

    expect(sendOTPEmail).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(409);
  });

  test('rejects a blank email with a clean 400 instead of a raw error', async () => {
    const req = { body: { email: '   ' } };
    const res = mockRes();
    await requestOTP(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('authController.loginWithOTP (regression test for the registration-bypass fix)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a correct OTP for an unverified/placeholder account', async () => {
    User.findOne.mockResolvedValue({
      email: 'ghost@college.edu',
      otp: '654321',
      otpExpiresAt: new Date(Date.now() + 60000),
      isVerified: false,
      save: jest.fn(),
    });

    const req = { body: { email: 'ghost@college.edu', otp: '654321' } };
    const res = mockRes();
    await loginWithOTP(req, res);

    // Must not succeed — this is the exact loophole that let someone
    // become "logged in" via the Login page's OTP tab without ever
    // completing registration (real name/phone/collegeId).
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ token: expect.anything() }));
  });

  test('accepts a correct OTP for a genuinely verified account', async () => {
    const user = {
      _id: 'u1', email: 'riya@college.edu', name: 'Riya', role: 'student', phone: '111',
      otp: '111222', otpExpiresAt: new Date(Date.now() + 60000), isVerified: true,
      save: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(user);

    const req = { body: { email: 'riya@college.edu', otp: '111222' } };
    const res = mockRes();
    await loginWithOTP(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, token: expect.any(String) }));
    expect(res.cookie).not.toHaveBeenCalled(); // sessions are per-tab tokens, never a shared cookie
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rejects an incorrect OTP', async () => {
    User.findOne.mockResolvedValue({
      email: 'riya@college.edu', otp: '111222', otpExpiresAt: new Date(Date.now() + 60000),
      isVerified: true, save: jest.fn(),
    });
    const req = { body: { email: 'riya@college.edu', otp: '000000' } };
    const res = mockRes();
    await loginWithOTP(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('rejects an expired OTP', async () => {
    User.findOne.mockResolvedValue({
      email: 'riya@college.edu', otp: '111222', otpExpiresAt: new Date(Date.now() - 1000),
      isVerified: true, save: jest.fn(),
    });
    const req = { body: { email: 'riya@college.edu', otp: '111222' } };
    const res = mockRes();
    await loginWithOTP(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('authController.register (regression test for account-overwrite fix)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a blank phone with a clear message, instead of a raw Mongoose ValidationError reaching the user', async () => {
    User.findOne.mockResolvedValue({
      _id: 'u5', email: 'newstudent3@college.edu', isVerified: false,
      otp: '333333', otpExpiresAt: new Date(Date.now() + 60000), save: jest.fn(),
    });
    const req = { body: { name: 'Valid Name', email: 'newstudent3@college.edu', password: 'pw123456', phone: '   ', collegeId: 'S3', otp: '333333' } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/phone number is required/i) }));
  });

  test('rejects a blank name with a clear message', async () => {
    User.findOne.mockResolvedValue({
      _id: 'u6', email: 'newstudent4@college.edu', isVerified: false,
      otp: '444444', otpExpiresAt: new Date(Date.now() + 60000), save: jest.fn(),
    });
    const req = { body: { name: '  ', email: 'newstudent4@college.edu', password: 'pw123456', phone: '5551234567', collegeId: 'S4', otp: '444444' } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/name is required/i) }));
  });

  test('rejects too-short passwords', async () => {
    User.findOne.mockResolvedValue({
      _id: 'u7', email: 'newstudent5@college.edu', isVerified: false,
      otp: '555555', otpExpiresAt: new Date(Date.now() + 60000), save: jest.fn(),
    });
    const req = { body: { name: 'Valid Name', email: 'newstudent5@college.edu', password: '123', phone: '5551234567', collegeId: 'S5', otp: '555555' } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/8 characters/i) }));
  });

  test('rejects re-registration of an already-verified account', async () => {
    User.findOne.mockResolvedValue({
      _id: 'u1',
      email: 'admin@college.edu',
      isVerified: true,
      otp: '123456',
      otpExpiresAt: new Date(Date.now() + 60000),
      save: jest.fn(),
    });

    const req = { body: { name: 'Attacker', email: 'admin@college.edu', password: 'newpass123', phone: '1', collegeId: 'X', otp: '123456' } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/already exists/i) })
    );
  });

  test('rejects an invalid OTP for a genuinely new/unverified account', async () => {
    User.findOne.mockResolvedValue({
      _id: 'u2',
      email: 'newstudent@college.edu',
      isVerified: false,
      otp: '111111',
      otpExpiresAt: new Date(Date.now() + 60000),
      save: jest.fn(),
    });

    const req = { body: { name: 'New', email: 'newstudent@college.edu', password: 'pw123456', phone: '1', collegeId: 'S1', otp: '000000' } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/invalid or expired otp/i) })
    );
  });

  test('completes registration for a genuinely new/unverified account with a correct OTP', async () => {
    const userDoc = {
      _id: 'u3',
      email: 'newstudent2@college.edu',
      isVerified: false,
      otp: '222222',
      otpExpiresAt: new Date(Date.now() + 60000),
      role: 'student',
      save: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(userDoc);

    const req = { body: { name: 'New Student', email: 'newstudent2@college.edu', password: 'pw123456', phone: '5551234567', collegeId: 'S2', otp: '222222' } };
    const res = mockRes();

    await register(req, res);

    expect(userDoc.save).toHaveBeenCalled();
    expect(userDoc.isVerified).toBe(true);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, token: expect.any(String) }));
    expect(res.cookie).not.toHaveBeenCalled(); // sessions are per-tab tokens, never a shared cookie
  });
});

describe('authController.updateProfile (new: profile page backend support)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updates only name and phone, trimmed', async () => {
    User.findByIdAndUpdate.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'u1', name: 'New Name', phone: '5551234' }) });

    const req = { user: { id: 'u1' }, body: { name: '  New Name  ', phone: ' 5551234 ' } };
    const res = mockRes();
    await updateProfile(req, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { name: 'New Name', phone: '5551234' },
      expect.objectContaining({ new: true, runValidators: true })
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('never allows email, password, role, or collegeId through — even if sent', async () => {
    User.findByIdAndUpdate.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'u1', name: 'X' }) });

    const req = {
      user: { id: 'u1' },
      body: { name: 'X', email: 'attacker@evil.com', role: 'admin', password: 'hacked', collegeId: 'FAKE' },
    };
    const res = mockRes();
    await updateProfile(req, res);

    const updatesArg = User.findByIdAndUpdate.mock.calls[0][1];
    expect(updatesArg).not.toHaveProperty('email');
    expect(updatesArg).not.toHaveProperty('role');
    expect(updatesArg).not.toHaveProperty('password');
    expect(updatesArg).not.toHaveProperty('collegeId');
  });

  test('rejects an empty name instead of silently blanking it out', async () => {
    const req = { user: { id: 'u1' }, body: { name: '   ' } };
    const res = mockRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects a request with nothing to update', async () => {
    const req = { user: { id: 'u1' }, body: {} };
    const res = mockRes();
    await updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
