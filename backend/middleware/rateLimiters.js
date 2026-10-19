const rateLimit = require('express-rate-limit');

// Limits are sized for a campus app: generous enough that a real student
// retrying a typo'd password/OTP a few times is never blocked, but tight
// enough to stop email-bombing, brute force, and spam posting.
const base = { standardHeaders: true, legacyHeaders: false };

// Safety net for every /api request, keyed by IP.
const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: { message: 'Too many requests. Please slow down and try again in a few minutes.' },
});

// Sending OTP emails (registration, OTP login, password reset).
const otpRequestLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: 'Too many code requests. Please wait a few minutes and try again.' },
});

// Password login and OTP verification — the endpoints where a brute-force
// attempt against a single account matters most.
const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Per-user limiters for authenticated write actions. Keyed by user id so
// one noisy account is throttled without penalising everyone behind the
// same campus NAT.
const perUser = (windowMs, max, message) => rateLimit({
  ...base,
  windowMs,
  max,
  keyGenerator: (req) => (req.user ? String(req.user._id) : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  message: { message },
});

const createItemLimiter = perUser(60 * 60 * 1000, 20, 'You have posted a lot of items recently. Please try again later.');
const claimLimiter = perUser(60 * 60 * 1000, 15, 'Too many claim requests. Please try again later.');
const messageLimiter = perUser(60 * 1000, 40, "You're sending messages too quickly. Please wait a moment.");

module.exports = { apiLimiter, otpRequestLimiter, loginLimiter, createItemLimiter, claimLimiter, messageLimiter };
