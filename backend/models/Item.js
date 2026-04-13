const mongoose = require('mongoose');

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
  status:       { type: String, enum: ['Open', 'Claimed', 'Closed'], default: 'Open' },
  lostFoundDate:{ type: Date, required: true },
  expiresAt:    { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
