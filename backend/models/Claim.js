const mongoose = require('mongoose');

// A claim is a request by a user to take ownership of someone else's
// item. The claimant explains how they can prove it (`message`); the item
// owner — or an admin — reviews it. Nothing changes hands automatically.
const claimSchema = new mongoose.Schema({
  itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  claimedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:      { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
  status:       { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  responseNote: { type: String, trim: true, maxlength: 300, default: '' },
  respondedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  respondedAt:  { type: Date },
}, { timestamps: true });

claimSchema.index({ itemId: 1, status: 1 });
claimSchema.index({ claimedBy: 1, createdAt: -1 });
// Database-level guarantee: one open claim per person per item, even if two
// requests race past the application-level check.
claimSchema.index(
  { itemId: 1, claimedBy: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('Claim', claimSchema);
