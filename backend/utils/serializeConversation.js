// Shapes a conversation for one viewer. The OTHER person's email and phone
// are only included once BOTH participants have chosen to share — before
// that the API simply does not send them (hiding them in the UI alone
// would still leave them readable in the network response).
function serializeConversation(conv, meId, unreadCount = 0) {
  const obj = typeof conv.toObject === 'function' ? conv.toObject() : conv;
  const bothShared = obj.shares.length > 0 && obj.shares.every((s) => s.shared === true);
  const participants = obj.participants.map((p) => {
    const isMe = String(p._id) === String(meId);
    const base = { _id: p._id, name: p.name };
    return isMe || bothShared ? { ...base, email: p.email, phone: p.phone } : base;
  });
  return { ...obj, participants, bothShared, unreadCount };
}

module.exports = { serializeConversation };
