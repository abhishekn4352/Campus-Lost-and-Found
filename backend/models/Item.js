const mongoose = require('mongoose');
const { ITEM_STATUS, ITEM_STATUS_VALUES } = require('../constants/itemStatus');

const itemSchema = new mongoose.Schema({
  postedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['lost', 'found'], required: true },
  title:        { type: String, required: true, trim: true },
  description:  { type: String, required: true },
  category:     {
    type: String,
    enum: ['Electronics', 'Books', 'ID Card', 'Keys', 'Wallet', 'Clothing', 'Sports', 'Other'],
    required: true
  },
  location:     { type: String, required: true },
  imageUrl:     { type: String, default: '' },
  status:       { type: String, enum: ITEM_STATUS_VALUES, default: ITEM_STATUS.OPEN },
  // True when the cron job auto-closed this item after it passed
  // `expiresAt` while still Open. Kept as a metadata flag rather than a
  // separate "Expired" status value so the status enum stays a simple,
  // linear Open -> Claimed -> Closed workflow with no contradictory states.
  autoClosed:   { type: Boolean, default: false },
  lostFoundDate:{ type: Date, required: true },
  expiresAt:    { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
