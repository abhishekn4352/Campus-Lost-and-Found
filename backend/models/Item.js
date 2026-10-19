const mongoose = require('mongoose');
const { ITEM_STATUS, ITEM_STATUS_VALUES } = require('../constants/itemStatus');
const { CATEGORIES } = require('../constants/categories');

const itemSchema = new mongoose.Schema({
  postedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['lost', 'found'], required: true },
  title:        { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  description:  { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
  category:     { type: String, enum: CATEGORIES, required: true },
  location:     { type: String, required: true, trim: true, maxlength: 120 },
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

// Browse/search always filters on status and sorts by newest; "my posts"
// filters on postedBy; the daily expiry job scans on status + expiresAt.
itemSchema.index({ status: 1, type: 1, createdAt: -1 });
itemSchema.index({ status: 1, category: 1, createdAt: -1 });
itemSchema.index({ postedBy: 1, createdAt: -1 });
itemSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Item', itemSchema);
