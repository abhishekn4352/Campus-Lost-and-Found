const mongoose = require('mongoose');

// One row per (person, browser). A browser profile has a single push
// endpoint, so when two people are signed in in the same browser (different
// tabs) both rows share the endpoint and each person only receives
// notifications addressed to them.
const pushSubscriptionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  endpoint:  { type: String, required: true, maxlength: 2048 },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true },
  },
  userAgent: { type: String, maxlength: 300 },
}, { timestamps: true });

pushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ endpoint: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
