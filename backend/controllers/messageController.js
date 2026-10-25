const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Item = require('../models/Item');
const User = require('../models/User');
const { sendMessageEmail } = require('../utils/sendOTP');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { clean, fail } = require('../utils/validators');
const { findOrCreateConversation } = require('../services/conversationService');
const { notifyUserSafe } = require('../services/pushService');
const { serializeConversation } = require('../utils/serializeConversation');

const INACTIVE_AFTER_MS = 3 * 60 * 1000;     // only email people who aren't looking at the app
const EMAIL_COOLDOWN_MS = 30 * 60 * 1000;    // at most one "new message" email per chat per 30 min

// Shared helper: loads a conversation and verifies req.user is one of its
// participants. Returns the conversation on success, or writes a 404/403
// response and returns null — callers should `return` immediately on null.
async function loadAuthorizedConversation(req, res, conversationId) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    res.status(404).json({ message: 'Conversation not found' });
    return null;
  }
  const isParticipant = conv.participants.some((p) => p.toString() === req.user._id.toString());
  if (!isParticipant) {
    res.status(403).json({ message: 'Not authorized to access this conversation' });
    return null;
  }
  return conv;
}

const POPULATE_PARTICIPANTS = 'name email phone';
const POPULATE_ITEM = 'title imageUrl type status';

// @desc    Open (or create) the conversation with an item's poster. Sends no
//          message and never trusts a client-supplied recipient.
// @route   POST /api/messages/start   { itemId }
exports.startConversation = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.body?.itemId);
  if (!item) return fail(res, 404, 'Item not found');
  if (String(item.postedBy) === String(req.user._id)) return fail(res, 400, 'This is your own post.');
  const conv = await findOrCreateConversation(item._id, req.user._id, item.postedBy);
  res.status(201).json({ conversationId: conv._id });
});

// @desc    Send a message in an existing conversation
// @route   POST /api/messages/send   { conversationId, content }
exports.sendMessage = asyncHandler(async (req, res) => {
  const content = clean(req.body?.content);
  const conversationId = req.body?.conversationId || req.body?.convId;
  if (!content) return fail(res, 400, 'Message content is required');
  if (content.length > 2000) return fail(res, 400, 'Messages can be up to 2000 characters.');
  if (!conversationId) return fail(res, 400, 'conversationId is required');

  const conv = await loadAuthorizedConversation(req, res, conversationId);
  if (!conv) return;

  const message = await Message.create({ conversationId: conv._id, sender: req.user._id, content });
  conv.lastMessage = message._id;

  // Email the other person if they're away — but only occasionally.
  try {
    const receiverId = conv.participants.find((p) => String(p) !== String(req.user._id));
    const [receiver, item] = await Promise.all([User.findById(receiverId), Item.findById(conv.itemId)]);
    if (receiver && item && receiver.isActive !== false) {
      notifyUserSafe(receiver._id, {
        title: 'New message',
        body: `${req.user.name} wrote to you about “${item.title}”`,
        url: `/messages/${conv._id}`,
        tag: `msg-${conv._id}`,
      });
    }
    const isInactive = receiver && (!receiver.lastActive || Date.now() - new Date(receiver.lastActive).getTime() > INACTIVE_AFTER_MS);
    const cooledDown = !conv.lastEmailAt || Date.now() - new Date(conv.lastEmailAt).getTime() > EMAIL_COOLDOWN_MS;
    if (isInactive && cooledDown && item && receiver.isActive !== false) {
      await sendMessageEmail(receiver.email, receiver.name, req.user.name, item.title);
      conv.lastEmailAt = new Date();
    }
  } catch (err) {
    console.error('Message notification email failed:', err.message); // never fail the send
  }
  await conv.save();

  res.status(201).json(message);
});

// @desc    All my conversations
// @route   GET /api/messages/conversations
exports.getConversations = asyncHandler(async (req, res) => {
  const convs = await Conversation.find({ participants: req.user._id })
    .populate('participants', POPULATE_PARTICIPANTS)
    .populate('itemId', POPULATE_ITEM)
    .populate('lastMessage')
    .sort('-updatedAt');

  // One grouped query for every unread count (instead of one per chat).
  const unread = await Message.aggregate([
    { $match: { conversationId: { $in: convs.map((c) => c._id) }, sender: { $ne: req.user._id }, read: false } },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } },
  ]);
  const unreadBy = new Map(unread.map((u) => [String(u._id), u.count]));

  res.json(convs
    .filter((c) => c.itemId) // skip chats whose item was deleted
    .map((c) => serializeConversation(c, req.user._id, unreadBy.get(String(c._id)) || 0)));
});

// @desc    One conversation (used by the chat window instead of loading all)
// @route   GET /api/messages/conversations/:id
exports.getConversation = asyncHandler(async (req, res) => {
  const authorized = await loadAuthorizedConversation(req, res, req.params.id);
  if (!authorized) return;
  const conv = await Conversation.findById(authorized._id)
    .populate('participants', POPULATE_PARTICIPANTS)
    .populate('itemId', POPULATE_ITEM);
  if (!conv?.itemId) return fail(res, 404, 'Conversation not found');
  res.json(serializeConversation(conv, req.user._id));
});

// @desc    Messages for a conversation (optionally only those after a time)
// @route   GET /api/messages/:convId?after=<ISO date>
exports.getMessages = asyncHandler(async (req, res) => {
  const { convId } = req.params;
  const conv = await loadAuthorizedConversation(req, res, convId);
  if (!conv) return; // response already sent (404 or 403)

  // Mark messages sent by others as read
  await Message.updateMany(
    { conversationId: convId, sender: { $ne: req.user._id }, read: false },
    { $set: { read: true } }
  );

  const filter = { conversationId: convId };
  const after = req.query?.after ? new Date(req.query.after) : null;
  if (after && !Number.isNaN(after.getTime())) filter.createdAt = { $gt: after };

  const messages = await Message.find(filter).sort('createdAt');
  res.json(messages);
});

// @desc    Toggle my consent to share contact info in this conversation
// @route   POST /api/messages/share-contact
exports.shareContact = asyncHandler(async (req, res) => {
  const { conversationId } = req.body || {};
  const userId = req.user._id;

  const conv = await loadAuthorizedConversation(req, res, conversationId);
  if (!conv) return; // response already sent (404 or 403)

  const userShare = conv.shares.find((s) => s.userId.toString() === userId.toString());
  if (userShare) userShare.shared = !userShare.shared;
  await conv.save();

  const bothShared = conv.shares.every((s) => s.shared === true);
  res.json({ shares: conv.shares, bothShared });
});
