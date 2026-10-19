// Small, dependency-free input helpers. Every controller that reads
// req.body goes through these so an attacker-supplied object/array
// (e.g. {"email": {"$gt": ""}}) can never reach a Mongo query or crash a
// .trim() call.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

const isString = (v) => typeof v === 'string';
const clean = (v) => (isString(v) ? v.trim() : '');
const isEmail = (v) => isString(v) && v.length <= 254 && EMAIL_RE.test(v.trim());
const isPhone = (v) => isString(v) && PHONE_RE.test(v.trim());
const toInt = (v, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

// Standard pagination parsing so every list endpoint behaves the same.
const parsePagination = (query, { defaultLimit = 12, maxLimit = 50 } = {}) => {
  const page = toInt(query.page, 1, { min: 1 });
  const limit = toInt(query.limit, defaultLimit, { min: 1, max: maxLimit });
  return { page, limit, skip: (page - 1) * limit };
};

const fail = (res, status, message, extra = {}) => res.status(status).json({ message, ...extra });

module.exports = { EMAIL_RE, PHONE_RE, isString, clean, isEmail, isPhone, toInt, parsePagination, fail };
