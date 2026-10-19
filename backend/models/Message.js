const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:        { type: String, required: true, trim: true, maxlength: 2000 },
  isSystem:       { type: Boolean, default: false },
  read:           { type: Boolean, default: false }
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, sender: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
