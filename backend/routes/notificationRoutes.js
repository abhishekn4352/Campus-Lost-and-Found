const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Item = require('../models/Item');
const Claim = require('../models/Claim');

router.use(protect);

// One small, cheap request for the navbar badges. Previously the navbar
// downloaded every conversation and every claim every 15 seconds.
router.get('/summary', asyncHandler(async (req, res) => {
  const me = req.user._id;
  const [convIds, myItemIds] = await Promise.all([
    Conversation.find({ participants: me }).distinct('_id'),
    Item.find({ postedBy: me }).distinct('_id'),
  ]);
  const [unreadMessages, claimsToReview, myPendingClaims] = await Promise.all([
    Message.countDocuments({ conversationId: { $in: convIds }, sender: { $ne: me }, read: false }),
    Claim.countDocuments({ itemId: { $in: myItemIds }, status: 'pending' }),
    Claim.countDocuments({ claimedBy: me, status: 'pending' }),
  ]);
  res.json({ unreadMessages, claimsToReview, myPendingClaims });
}));

module.exports = router;
