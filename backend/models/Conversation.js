const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  lastMessage:  { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  // Throttles "you have a new message" emails so a busy chat can't spam
  // someone's inbox.
  lastEmailAt:  { type: Date },
  shares: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shared: { type: Boolean, default: false }
  }]
}, { timestamps: true });

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ itemId: 1, participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
