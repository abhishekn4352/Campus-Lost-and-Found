const crypto = require('crypto');

// crypto.randomInt is cryptographically secure; Math.random is not and
// must never be used for security codes.
exports.generateOTP = () => crypto.randomInt(100000, 1000000).toString();
