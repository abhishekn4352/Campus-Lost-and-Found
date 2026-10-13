const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateOTP } = require('../utils/generateOTP');
const { sendOTPEmail } = require('../utils/sendOTP');
const { asyncHandler } = require('../middleware/errorMiddleware');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id, user.role);
  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({ success: true, user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
};

// @desc    Request OTP for Registration or Login
// @route   POST /api/auth/request-otp
exports.requestOTP = async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    let user = await User.findOne({ email: normalizedEmail });

    // This endpoint is only for completing a NEW registration when called
    // with purpose: 'register'. If the account already exists and is
    // verified, tell the user immediately (no OTP sent) instead of
    // sending a real OTP email and only rejecting them later at the
    // register-verify step.
    if (purpose === 'register' && user?.isVerified) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in instead.' });
    }

    if (!user) {
      // Placeholder account for a brand-new registration. Every field the
      // User schema requires (name, password, phone, collegeId) must be
      // given a real, non-empty value here or Mongoose will reject the
      // .save() below — Mongoose's `required` validator for a String
      // field rejects an empty string just like it rejects
      // null/undefined, it is NOT satisfied by ''. (An earlier version of
      // this fix used phone: '' on the mistaken assumption that an empty
      // string would pass; verified against the real schema with
      // validateSync() that it does not.) These placeholder values are
      // always overwritten with the real submitted data in register().
      user = new User({
        email: normalizedEmail,
        name: 'New User',
        password: crypto.randomBytes(24).toString('hex'),
        phone: 'PENDING',
        collegeId: 'PENDING'
      });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    await sendOTPEmail(normalizedEmail, user.isVerified ? user.name : 'New User', otp);
    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
    res.status(500).json({ message: 'Unable to send OTP right now. Please try again.' });
  }
};

// @desc    Verify OTP and Register
// @route   POST /api/auth/register-verify
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, collegeId, otp } = req.body;
    if (!email) return res.status(400).json({ message: 'Invalid or expired OTP' });
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    // This endpoint is for completing a NEW registration. An already
    // verified account must go through /login or /login-otp instead —
    // otherwise anyone who obtained a valid OTP for an existing verified
    // email (e.g. a compromised inbox) could overwrite that account's
    // name/password/phone/collegeId here.
    if (user.isVerified) {
      return res.status(400).json({ message: 'An account with this email already exists. Please log in instead.' });
    }
    if (!otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Explicit, clear validation before touching the database — every one
    // of these is required by the schema, and a raw Mongoose
    // ValidationError message ("User validation failed: phone: Path...")
    // is exactly the kind of confusing, developer-facing error a real
    // user should never see.
    const trimmedName = (name || '').trim();
    const trimmedPhone = (phone || '').trim();
    const trimmedCollegeId = (collegeId || '').trim();
    if (!trimmedName) return res.status(400).json({ message: 'Full name is required.' });
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (!trimmedPhone) return res.status(400).json({ message: 'Phone number is required.' });
    if (!trimmedCollegeId) return res.status(400).json({ message: 'College ID is required.' });

    user.name = trimmedName;
    user.password = password;
    user.phone = trimmedPhone;
    user.collegeId = trimmedCollegeId;
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    sendTokenResponse(user, 201, res);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const firstMessage = Object.values(err.errors)[0]?.message || 'Please check your details and try again.';
      return res.status(400).json({ message: firstMessage });
    }
    res.status(500).json({ message: 'Unable to complete registration right now. Please try again.' });
  }
};

// @desc    Login with Password
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ message: 'Unable to sign in right now. Please try again.' });
  }
};

// @desc    Login with OTP
// @route   POST /api/auth/login-otp
exports.loginWithOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user || user.otp !== otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    // OTP login must only work for accounts that already completed real
    // registration. Without this check, requesting an OTP for ANY email
    // (which auto-creates an unverified placeholder — see requestOTP)
    // followed by a correct OTP would silently log the person in with a
    // placeholder name/phone/collegeId, bypassing registration entirely.
    if (!user.isVerified) {
      return res.status(404).json({ message: "We couldn't find an account for this email. Please register first." });
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ message: 'Unable to sign in right now. Please try again.' });
  }
};

// @desc    Logout User / Clear Cookie
// @route   GET /api/auth/logout
exports.logout = async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ success: true, message: 'Logged out' });
};

exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// @desc    Update the current user's own profile
// @route   PUT /api/auth/profile
// Deliberately narrow allowlist: name and phone only. Email is tied to
// OTP verification and login identity; password has its own hashing
// flow; collegeId and role are not user-editable. Expanding this list
// later is easy — silently allowing more here is not something to do
// by accident.
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const updates = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) return res.status(400).json({ message: 'Name cannot be empty.' });
    updates.name = trimmed;
  }
  if (phone !== undefined) {
    const trimmed = phone.trim();
    if (!trimmed) return res.status(400).json({ message: 'Phone cannot be empty.' });
    updates.phone = trimmed;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true,
  }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});
