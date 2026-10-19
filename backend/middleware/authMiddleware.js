const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Never hand the OTP, its expiry/attempt counter or the password hash to
// route handlers — nothing downstream needs them and they must not end up
// in a JSON response by accident.
const SAFE_USER_FIELDS = '-password -otp -otpExpiresAt -otpAttempts';

const getToken = (req) => {
  if (req.cookies?.token) return req.cookies.token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

// Resolves the user for a request, or returns null (no/invalid token).
async function resolveUser(req) {
  const token = getToken(req);
  if (!token) return { error: 'Unauthorized access, no token' };

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { error: 'Token invalid or expired' };
  }

  const user = await User.findById(decoded.id).select(SAFE_USER_FIELDS);
  if (!user) return { error: 'User not found' };
  if (user.isActive === false) return { error: 'This account has been suspended. Contact a campus admin.', status: 403 };

  // Refresh lastActive at most once a minute. A targeted update avoids
  // re-running full-document validation on every request.
  if (!user.lastActive || Date.now() - new Date(user.lastActive).getTime() > 60000) {
    user.lastActive = new Date();
    User.updateOne({ _id: user._id }, { lastActive: user.lastActive }).catch(() => {});
  }
  return { user };
}

exports.protect = async (req, res, next) => {
  try {
    const { user, error, status } = await resolveUser(req);
    if (!user) return res.status(status || 401).json({ message: error });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

// For public routes that can show a bit more to a signed-in viewer. A
// missing/invalid token simply means "anonymous" — it is never an error.
exports.optionalAuth = async (req, res, next) => {
  try {
    const { user } = await resolveUser(req);
    if (user) req.user = user;
  } catch {
    // treat any lookup failure as anonymous
  }
  next();
};

exports.SAFE_USER_FIELDS = SAFE_USER_FIELDS;
