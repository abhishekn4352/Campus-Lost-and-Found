const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { generateOTP } = require('../utils/generateOTP');
const { sendOTPEmail } = require('../utils/sendOTP');

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
    const { email } = req.body;
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    let user = await User.findOne({ email });
    if (!user) {
      // For registration, we create a temporary placeholder or handle it in verify
      // For simplicity, we can create the user but mark isVerified: false
      user = new User({ 
        email, 
        name: 'Guest', 
        password: Math.random().toString(36), // Random pass for now
        collegeId: 'PENDING' 
      });
    }

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    await sendOTPEmail(email, user.name === 'Guest' ? 'New User' : user.name, otp);
    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Verify OTP and Register
// @route   POST /api/auth/register-verify
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, collegeId, otp } = req.body;
    console.log(`Verification attempt for ${email} with OTP ${otp}`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('User not found during verification');
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    if (user.otp !== otp) {
      console.log(`OTP mismatch: expected ${user.otp}, got ${otp}`);
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    if (new Date() > user.otpExpiresAt) {
      console.log('OTP expired');
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.name = name;
    user.password = password;
    user.phone = phone;
    user.collegeId = collegeId;
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Login with Password
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Login with OTP
// @route   POST /api/auth/login-otp
exports.loginWithOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || new Date() > user.otpExpiresAt) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.isVerified = true; // Ensure verified if logging in via OTP
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
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

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
};
