const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateOTP } = require('../utils/generateOTP');
const { sendOTPEmail } = require('../utils/sendOTP');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { SAFE_USER_FIELDS } = require('../middleware/authMiddleware');
const { isString, clean, isEmail, isPhone, fail } = require('../utils/validators');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_GAP_MS = 30 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt silently ignores anything past 72 bytes

// Used to burn the same CPU time when an email isn't registered, so response
// timing doesn't reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// SameSite=Lax works when the site and API share a registrable domain (or
// run behind one reverse proxy). If the frontend and API live on different
// domains (e.g. two *.vercel.app / *.onrender.com hosts), set
// COOKIE_SAMESITE=none — the cookie is then always Secure.
const cookieOptions = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
  };
};

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  collegeId: user.collegeId,
  role: user.role,
});

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);
  res
    .status(statusCode)
    .cookie('token', token, { ...cookieOptions(), expires: new Date(Date.now() + SEVEN_DAYS_MS) })
    .json({ success: true, user: publicUser(user) });
};

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// Checks a submitted OTP against the one stored on the user. A wrong guess
// counts against a per-code budget; once spent, the code is destroyed and
// the person must request a new one.
async function checkOtp(user, submitted) {
  const supplied = isString(submitted) ? submitted.trim() : '';
  const valid =
    !!user.otp &&
    !!user.otpExpiresAt &&
    new Date() <= user.otpExpiresAt &&
    (user.otpAttempts || 0) < MAX_OTP_ATTEMPTS &&
    safeEqual(user.otp, supplied);

  if (!valid && user.otp) {
    const attempts = (user.otpAttempts || 0) + 1;
    const update = attempts >= MAX_OTP_ATTEMPTS
      ? { $set: { otpAttempts: attempts }, $unset: { otp: 1, otpExpiresAt: 1 } }
      : { $set: { otpAttempts: attempts } };
    await User.updateOne({ _id: user._id }, update);
  }
  return valid;
}

const OTP_PURPOSE_LABEL = {
  register: 'finish creating your account',
  reset: 'reset your password',
  login: 'sign in',
};

// @desc    Request OTP for Registration, OTP login or password reset
// @route   POST /api/auth/request-otp
exports.requestOTP = asyncHandler(async (req, res) => {
  const { email, purpose } = req.body || {};
  if (!isString(email) || !email.trim()) return fail(res, 400, 'Email is required');
  if (!isEmail(email)) return fail(res, 400, 'Please enter a valid email address.');
  const normalizedEmail = email.trim().toLowerCase();
  const isRegistration = purpose === 'register';

  let user = await User.findOne({ email: normalizedEmail });

  // Registration against an existing, verified account is an immediate,
  // explicit error — the person needs to be told to log in instead.
  if (isRegistration && user?.isVerified) {
    return fail(res, 409, 'An account with this email already exists. Please log in instead.');
  }

  if (!isRegistration) {
    // Login / reset codes are only ever sent to real, active accounts. For
    // anything else we answer identically and do nothing, so this endpoint
    // can't be used to discover who is registered, and it never creates
    // junk placeholder accounts.
    if (!user || !user.isVerified || user.isActive === false) {
      return res.json({ message: 'If an account exists for this email, an OTP has been sent.' });
    }
  }

  // Minimum gap between codes for the same account (also blunts email-bombing
  // a victim's inbox from many IPs).
  if (user?.otpExpiresAt) {
    const issuedAt = new Date(user.otpExpiresAt).getTime() - OTP_TTL_MS;
    if (Date.now() - issuedAt < OTP_RESEND_GAP_MS) {
      return fail(res, 429, 'Please wait 30 seconds before requesting another code.');
    }
  }

  if (!user) {
    // Placeholder account for a brand-new registration. Every field the
    // User schema requires must be given a real, non-empty value here or
    // Mongoose will reject the .save() below (an empty string does NOT
    // satisfy `required`). These values are always overwritten with the
    // real submitted data in register().
    user = new User({
      email: normalizedEmail,
      name: 'New User',
      password: crypto.randomBytes(24).toString('hex'),
      phone: 'PENDING',
      collegeId: 'PENDING',
    });
  }

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  await user.save();

  try {
    await sendOTPEmail(
      normalizedEmail,
      user.isVerified ? user.name : null,
      otp,
      OTP_PURPOSE_LABEL[purpose] || OTP_PURPOSE_LABEL.login
    );
  } catch (err) {
    console.error('Failed to send OTP email:', err.message);
    return fail(res, 502, 'We could not send the email right now. Please try again in a minute.');
  }
  res.json({ message: 'OTP sent to your email' });
});

// @desc    Verify OTP and Register
// @route   POST /api/auth/register-verify
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, collegeId, otp } = req.body || {};
  if (!isString(email)) return fail(res, 400, 'Invalid or expired OTP');
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) return fail(res, 400, 'Invalid or expired OTP');
  // This endpoint is for completing a NEW registration. An already
  // verified account must go through /login or /login-otp instead —
  // otherwise anyone who obtained a valid OTP for an existing verified
  // email could overwrite that account's name/password/phone/collegeId.
  if (user.isVerified) {
    return fail(res, 400, 'An account with this email already exists. Please log in instead.');
  }
  if (!(await checkOtp(user, otp))) return fail(res, 400, 'Invalid or expired OTP');

  // Explicit, clear validation before touching the database — a raw
  // Mongoose ValidationError ("User validation failed: phone: Path...") is
  // exactly the kind of developer-facing error a real user should never see.
  const trimmedName = clean(name);
  const trimmedPhone = clean(phone);
  const trimmedCollegeId = clean(collegeId);
  if (!trimmedName) return fail(res, 400, 'Full name is required.');
  if (trimmedName.length > 80) return fail(res, 400, 'Name must be 80 characters or fewer.');
  if (!isString(password) || password.length < MIN_PASSWORD_LENGTH) {
    return fail(res, 400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) return fail(res, 400, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);
  if (!trimmedPhone) return fail(res, 400, 'Phone number is required.');
  if (!isPhone(trimmedPhone)) return fail(res, 400, 'Please enter a valid phone number.');
  if (!trimmedCollegeId) return fail(res, 400, 'College ID is required.');

  // One college ID = one account, so nobody can sign up as someone else.
  const idTaken = await User.exists({ collegeId: trimmedCollegeId, isVerified: true, _id: { $ne: user._id } });
  if (idTaken) return fail(res, 409, 'An account with this college ID already exists.');

  user.name = trimmedName;
  user.password = password;
  user.phone = trimmedPhone;
  user.collegeId = trimmedCollegeId;
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  user.otpAttempts = 0;
  await user.save();

  sendTokenResponse(user, 201, res);
});

// @desc    Login with Password
// @route   POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isString(email) || !isString(password) || !email.trim() || !password) {
    return fail(res, 400, 'Email and password are required');
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user || !user.isVerified) {
    await bcrypt.compare(password, DUMMY_HASH); // equalise timing
    return fail(res, 401, 'Invalid email or password');
  }
  if (!(await user.matchPassword(password))) return fail(res, 401, 'Invalid email or password');
  if (user.isActive === false) return fail(res, 403, 'This account has been suspended. Contact a campus admin.');

  sendTokenResponse(user, 200, res);
});

// @desc    Login with OTP
// @route   POST /api/auth/login-otp
exports.loginWithOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body || {};
  if (!isString(email) || !isString(otp) || !email.trim() || !otp) {
    return fail(res, 400, 'Email and OTP are required');
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user || !(await checkOtp(user, otp))) return fail(res, 401, 'Invalid or expired OTP');

  // OTP login must only work for accounts that already completed real
  // registration — otherwise a placeholder could be "logged in" with a
  // fake name/phone/collegeId, bypassing registration entirely.
  if (!user.isVerified) {
    return fail(res, 404, "We couldn't find an account for this email. Please register first.");
  }
  if (user.isActive === false) return fail(res, 403, 'This account has been suspended. Contact a campus admin.');

  user.otp = undefined;
  user.otpExpiresAt = undefined;
  user.otpAttempts = 0;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Set a new password using an emailed OTP (forgot password)
// @route   POST /api/auth/reset-password
exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!isString(email) || !isString(otp) || !isString(newPassword)) {
    return fail(res, 400, 'Email, code and new password are required.');
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) return fail(res, 400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (newPassword.length > MAX_PASSWORD_LENGTH) return fail(res, 400, `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || !user.isVerified || !(await checkOtp(user, otp))) return fail(res, 400, 'Invalid or expired OTP');

  user.password = newPassword;
  user.otp = undefined;
  user.otpExpiresAt = undefined;
  user.otpAttempts = 0;
  await user.save();
  res.json({ message: 'Password updated. You can now sign in.' });
});

// @desc    Change password while signed in
// @route   PUT /api/auth/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!isString(currentPassword) || !isString(newPassword)) return fail(res, 400, 'Current and new password are required.');
  if (newPassword.length < MIN_PASSWORD_LENGTH) return fail(res, 400, `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (newPassword.length > MAX_PASSWORD_LENGTH) return fail(res, 400, `New password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);
  if (newPassword === currentPassword) return fail(res, 400, 'New password must be different from the current one.');

  const user = await User.findById(req.user._id);
  if (!user || !(await user.matchPassword(currentPassword))) return fail(res, 400, 'Current password is incorrect.');

  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password changed.' });
});

// @desc    Logout User / Clear Cookie
// @route   GET /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie('token', cookieOptions());
  res.status(200).json({ success: true, message: 'Logged out' });
};

exports.getMe = asyncHandler(async (req, res) => {
  // `protect` already loaded the current user (without secrets).
  res.json(req.user);
});

// @desc    Update the current user's own profile
// @route   PUT /api/auth/profile
// Deliberately narrow allowlist: name and phone only. Email is tied to
// OTP verification and login identity; password has its own flow; collegeId
// and role are not user-editable.
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body || {};
  const updates = {};
  if (name !== undefined) {
    const trimmed = clean(name);
    if (!trimmed) return fail(res, 400, 'Name cannot be empty.');
    if (trimmed.length > 80) return fail(res, 400, 'Name must be 80 characters or fewer.');
    updates.name = trimmed;
  }
  if (phone !== undefined) {
    const trimmed = clean(phone);
    if (!trimmed) return fail(res, 400, 'Phone cannot be empty.');
    if (!isPhone(trimmed)) return fail(res, 400, 'Please enter a valid phone number.');
    updates.phone = trimmed;
  }
  if (Object.keys(updates).length === 0) return fail(res, 400, 'Nothing to update.');

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true,
  }).select(SAFE_USER_FIELDS);
  if (!user) return fail(res, 404, 'User not found');
  res.json(user);
});
