const path = require('path');
const fs = require('fs');

// Absolute and overridable, so uploads never depend on the process's
// working directory (the old relative 'uploads/' broke whenever the server
// was started from anywhere but /backend) and can be pointed at a mounted
// persistent volume in production.
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.error('[config] Could not create upload directory:', err.message);
}

module.exports = { UPLOAD_DIR };
