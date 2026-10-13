const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Item = require('../models/Item');
const User = require('../models/User');
const { sendMessageEmail } = require('../utils/sendOTP');

// Shared helper: loads a conversation and verifies req.user is one of its
// participants. Returns { conv } on success, or writes a 404/403 response
// and returns null on failure — callers should `return` immediately when
// they get `null` back.
async function loadAuthorizedConversation(req, res, conversationId) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    res.status(404).json({ message: 'Conversation not found' });
    return null;
  }
  const isParticipant = conv.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isParticipant) {
    res.status(403).json({ message: 'Not authorized to access this conversation' });
    return null;
  }
  return conv;
}

// @desc    Send a message (and potentially start a conversation)
// @route   POST /api/messages/send
exports.sendMessage = async (req, res) => {
  try {
    const { itemId, receiverId, content } = req.body;
    const senderId = req.user._id;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    if (!receiverId || receiverId === senderId.toString()) {
      return res.status(400).json({ message: 'Invalid recipient' });
    }

    // 1. Find or create conversation
    let conv = await Conversation.findOne({
      itemId,
      participants: { $all: [senderId, receiverId] }
    });

    if (!conv) {
      conv = await Conversation.create({
        itemId,
        participants: [senderId, receiverId],
        shares: [
          { userId: senderId, shared: false },
          { userId: receiverId, shared: false }
        ]
      });
    } else if (!conv.participants.some((p) => p.toString() === senderId.toString())) {
      // Defensive: conversation existed but the sender isn't part of it.
      return res.status(403).json({ message: 'Not authorized to message in this conversation' });
    }

    // 2. Create message
    const message = await Message.create({
      conversationId: conv._id,
      sender: senderId,
      content
    });

    // 3. Update conversation last message
    conv.lastMessage = message._id;
    await conv.save();

    // 4. Smart Email Notification
    try {
      const receiver = await User.findById(receiverId);
      const item = await Item.findById(itemId);

      const isInactive = receiver && (!receiver.lastActive || (Date.now() - new Date(receiver.lastActive).getTime() > 180000)); // 3 mins

      if (isInactive && item) {
        await sendMessageEmail(receiver.email, receiver.name, req.user.name, item.title);
        console.log(`Smart Email sent to ${receiver.email} - Inactivity detected.`);
      }
    } catch (err) {
      console.error('Smart Email failed:', err);
      // Don't fail the message sending if email fails
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all conversations for a user
// @route   GET /api/messages/conversations
exports.getConversations = async (req, res) => {
  try {
    const convs = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name email phone')
      .populate('itemId', 'title imageUrl type status')
      .populate('lastMessage')
      .sort('-updatedAt');

    // Add unread count to each conversation
    const mapped = await Promise.all(convs.map(async (c) => {
      const uCount = await Message.countDocuments({
        conversationId: c._id,
        sender: { $ne: req.user._id },
        read: false
      });
      return { ...c.toObject(), unreadCount: uCount };
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/:convId
exports.getMessages = async (req, res) => {
  try {
    const { convId } = req.params;

    const conv = await loadAuthorizedConversation(req, res, convId);
    if (!conv) return; // response already sent (404 or 403)

    // Mark messages sent by others as read
    await Message.updateMany(
      { conversationId: convId, sender: { $ne: req.user._id }, read: false },
      { $set: { read: true } }
    );

    const messages = await Message.find({ conversationId: convId })
      .sort('createdAt');
    res.json(messages);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Conversation not found' });
    res.status(500).json({ message: err.message });
  }
};

// @desc    Toggle contact info sharing
// @route   POST /api/messages/share-contact
exports.shareContact = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user._id;

    const conv = await loadAuthorizedConversation(req, res, conversationId);
    if (!conv) return; // response already sent (404 or 403)

    // Update specific user's share status
    const userShare = conv.shares.find(s => s.userId.toString() === userId.toString());
    if (userShare) {
      userShare.shared = !userShare.shared;
    }

    await conv.save();

    // Check if both shared
    const bothShared = conv.shares.every(s => s.shared === true);

    res.json({ shares: conv.shares, bothShared });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Conversation not found' });
    res.status(500).json({ message: err.message });
  }
};
