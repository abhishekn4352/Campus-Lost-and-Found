const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const { validateEnv } = require('./config/env');
// A misconfigured deployment should stop with ONE clear line, not a stack trace.
try {
  validateEnv();
} catch (err) {
  console.error(`\n${err.message} Fix the items above, then start again.`);
  process.exit(1);
}

const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Only start accepting requests once the DB connection is established, so
// the app never serves traffic that is guaranteed to fail.
connectDB().then(() => {
  require('./utils/cronJobs');
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`));

  // Graceful shutdown: stop taking new connections, let in-flight requests
  // finish, close the DB, then exit. Platforms send SIGTERM on every deploy.
  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await mongoose.connection.close(false).catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref(); // hard stop if something hangs
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});

process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));
