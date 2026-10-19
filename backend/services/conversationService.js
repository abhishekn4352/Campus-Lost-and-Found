const Conversation = require('../models/Conversation');

// One conversation per (item, pair of people). Returns the existing one if
// it's already there.
async function findOrCreateConversation(itemId, userA, userB) {
  const a = String(userA);
  const b = String(userB);
  let conv = await Conversation.findOne({ itemId, participants: { $all: [a, b] } });
  if (!conv) {
    conv = await Conversation.create({
      itemId,
      participants: [a, b],
      shares: [
        { userId: a, shared: false },
        { userId: b, shared: false },
      ],
    });
  }
  return conv;
}

module.exports = { findOrCreateConversation };
