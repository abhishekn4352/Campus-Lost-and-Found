const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true, maxlength: 80 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 8 },
  phone:     { type: String, required: true },
  collegeId: { type: String, required: true, trim: true, maxlength: 40 },
  role:      { type: String, enum: ['student', 'admin'], default: 'student' },
  otp:          { type: String },
  otpExpiresAt: { type: Date },
  // Wrong-guess counter for the current OTP. After a handful of misses the
  // code is burned and a new one must be requested, so a 6-digit code can't
  // be brute-forced from many IPs inside its 10-minute window.
  otpAttempts:  { type: Number, default: 0 },
  // Email change in progress: the new address only replaces the current one
  // after its owner types the code we mailed to it.
  pendingEmail:          { type: String, lowercase: true, trim: true },
  pendingEmailOtp:       { type: String },
  pendingEmailExpiresAt: { type: Date },
  pendingEmailAttempts:  { type: Number, default: 0 },
  isVerified:   { type: Boolean, default: false },
  // Admins can suspend an account (abuse, spam) without deleting its history.
  isActive:     { type: Boolean, default: true },
  lastActive:   { type: Date, default: Date.now },
}, { timestamps: true });

// A college ID identifies one person. Enforced only among verified
// accounts, because unverified sign-up placeholders all carry 'PENDING'.
userSchema.index(
  { collegeId: 1 },
  { unique: true, partialFilterExpression: { isVerified: true } }
);
userSchema.index({ role: 1, createdAt: -1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
