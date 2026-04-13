const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  claimedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  otp:          { type: String, required: true },
  otpVerified:  { type: Boolean, default: false },
  otpExpiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) },
  status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('Claim', claimSchema);
