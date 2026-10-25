const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimiters');
const { UPLOAD_DIR } = require('./config/paths');

const app = express();

// Behind a reverse proxy / PaaS (Render, Railway, Nginx…) the real client IP
// is in X-Forwarded-For. Without this, every user shares the proxy's IP and
// the rate limiters would throttle the whole campus as one person.
// TRUST_PROXY accepts a hop count ("1") or "true".
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY;
  app.set('trust proxy', v === 'true' ? true : Number.isNaN(Number(v)) ? v : Number(v));
}
app.disable('x-powered-by');

// Uploaded images are loaded by the frontend from a different origin, so
// they must be allowed cross-origin (helmet's default would block them).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

// FRONTEND_URL may hold several comma-separated origins. Localhost dev
// origins are only accepted outside production.
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:5173']),
];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error('Not allowed by CORS');
    err.statusCode = 403;
    callback(err);
  },
}));

app.use(express.json({ limit: '50kb' }));

// Uploaded files never change after creation (names are unique), so they
// can be cached aggressively.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, index: false }));

// Liveness/readiness probe for load balancers and uptime monitors.
app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'connected' : 'disconnected', uptime: Math.round(process.uptime()) });
});

app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/items', require('./routes/itemRoutes'));
app.use('/api/claims', require('./routes/claimRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Must be registered after all routes: catches unmatched routes, then
// forwards every error to a single, consistent JSON error response.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
