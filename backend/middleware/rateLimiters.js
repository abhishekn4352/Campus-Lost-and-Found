const rateLimit = require('express-rate-limit');

// Limits sized for a campus app: generous enough that a real student
// retrying a typo'd password/OTP a few times is never blocked, but tight
// enough to stop email-bombing via /request-otp and brute-forcing a
// 6-digit OTP or a password within the OTP's 10-minute window.

// Applies to sending OTP emails (registration + OTP login). Keyed by IP;
// a shared campus NAT could hit this under heavy simultaneous use, so the
// window is short and the cap generous.
const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please wait a few minutes and try again.' },
});

// Applies to password login and OTP verification (login-otp) — the
// endpoints where a brute-force attempt against a single account matters
// most.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait a few minutes and try again.' },
});

module.exports = { otpRequestLimiter, loginLimiter };
