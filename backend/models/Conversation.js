const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  itemId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  lastMessage:  { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  shares: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    shared: { type: Boolean, default: false }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
