// Fail fast on a misconfigured deployment instead of booting into a state
// where every request fails in a confusing way (or, worse, runs with a
// guessable JWT secret).
const isProduction = () => process.env.NODE_ENV === 'production';

function validateEnv() {
  const problems = [];
  const warnings = [];

  if (!process.env.MONGO_URI) problems.push('MONGO_URI is not set.');
  if (!process.env.JWT_SECRET) {
    problems.push('JWT_SECRET is not set.');
  } else if (isProduction() && process.env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production.');
  }

  if (isProduction() && !process.env.FRONTEND_URL) {
    problems.push('FRONTEND_URL is required in production (it is used for CORS and email links).');
  }
  if (!process.env.BREVO_API_KEY && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
    if (isProduction()) problems.push('Either BREVO_API_KEY or (EMAIL_USER and EMAIL_PASS) is required in production (OTP emails cannot be sent without them).');
    else warnings.push('Email credentials not set — OTP emails will be printed to the console instead of sent.');
  }

  const hasPub = !!process.env.VAPID_PUBLIC_KEY;
  const hasPriv = !!process.env.VAPID_PRIVATE_KEY;
  if (hasPub !== hasPriv) problems.push('Set BOTH VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (or neither). Generate a pair with: npm run vapid');
  else if (!hasPub) warnings.push('VAPID keys not set — push notifications are disabled. Generate keys with: npm run vapid');

  warnings.forEach((w) => console.warn(`[config] ${w}`));
  if (problems.length) {
    problems.forEach((p) => console.error(`[config] ${p}`));
    throw new Error(`Invalid environment configuration (${problems.length} problem${problems.length > 1 ? 's' : ''}).`);
  }
}

module.exports = { validateEnv, isProduction };
