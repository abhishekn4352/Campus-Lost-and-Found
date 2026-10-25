const Claim = require('../models/Claim');
const Item = require('../models/Item');
const User = require('../models/User');
const { ITEM_STATUS } = require('../constants/itemStatus');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { clean, fail } = require('../utils/validators');
const { resolveClaim } = require('../services/claimService');
const { sendClaimReceivedEmail } = require('../utils/sendOTP');
const { notifyUserSafe } = require('../services/pushService');

// @desc    Ask to claim a found item, explaining how you can prove it's yours
// @route   POST /api/claims/request/:itemId
exports.requestClaim = asyncHandler(async (req, res) => {
  const message = clean(req.body?.message);
  if (message.length < 10) return fail(res, 400, 'Describe how you can prove this is yours (at least 10 characters) — e.g. unique marks, what is inside, when you lost it.');
  if (message.length > 500) return fail(res, 400, 'Please keep your explanation under 500 characters.');

  const item = await Item.findById(req.params.itemId);
  if (!item) return fail(res, 404, 'Item not found');
  if (item.type !== 'found') {
    return fail(res, 400, 'Only found items can be claimed. If you found this lost item, send the owner a message instead.');
  }
  if (item.status !== ITEM_STATUS.OPEN) return fail(res, 400, 'This item is no longer available to claim.');
  if (String(item.postedBy) === String(req.user._id)) return fail(res, 400, 'You cannot claim your own item.');

  const existing = await Claim.findOne({ itemId: item._id, claimedBy: req.user._id, status: 'pending' });
  if (existing) return fail(res, 409, 'You already have a pending claim for this item.', { claimId: existing._id });

  const claim = await Claim.create({ itemId: item._id, claimedBy: req.user._id, message });

  // Notify the poster — best effort.
  User.findById(item.postedBy).select('name email').then((owner) => {
    if (!owner) return null;
    notifyUserSafe(owner._id, {
      title: 'Someone wants to claim your item',
      body: `${req.user.name} sent a claim for “${item.title}”`,
      url: '/claims?tab=received',
      tag: `claim-${claim._id}`,
    });
    return sendClaimReceivedEmail(owner.email, owner.name, req.user.name, item.title);
  }).catch((err) => console.error('Claim email failed:', err.message));

  res.status(201).json({ message: 'Claim submitted. The finder will review it.', claim });
});

// @desc    Claims I have made
// @route   GET /api/claims/my-claims
exports.getMyClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find({ claimedBy: req.user._id })
    .populate('itemId', 'title type category imageUrl status location')
    .sort('-createdAt');
  res.json(claims);
});

// @desc    Claims other people made on items I posted (newest pending first)
// @route   GET /api/claims/received
exports.getReceivedClaims = asyncHandler(async (req, res) => {
  const myItemIds = await Item.find({ postedBy: req.user._id }).distinct('_id');
  const claims = await Claim.find({ itemId: { $in: myItemIds } })
    .populate('itemId', 'title type category imageUrl status location')
    // Only the claimant's name is shared. Contact details stay private until
    // both people choose to share them in the chat.
    .populate('claimedBy', 'name')
    .sort('-createdAt');

  const rank = { pending: 0, approved: 1, rejected: 2, cancelled: 3 };
  claims.sort((a, b) => (rank[a.status] - rank[b.status]) || (b.createdAt - a.createdAt));
  res.json(claims);
});

// @desc    Approve or reject a claim on my item
// @route   PUT /api/claims/:id/respond   { action: 'approve' | 'reject', note? }
exports.respondToClaim = asyncHandler(async (req, res) => {
  const { claim, conversationId } = await resolveClaim({
    claimId: req.params.id,
    actor: req.user,
    action: req.body?.action,
    note: req.body?.note,
  });
  res.json({
    message: claim.status === 'approved' ? 'Claim approved. Chat with the claimant to arrange the handover.' : 'Claim rejected.',
    claim,
    conversationId,
  });
});

// @desc    Withdraw my own pending claim
// @route   DELETE /api/claims/:id
exports.cancelClaim = asyncHandler(async (req, res) => {
  const claim = await Claim.findById(req.params.id);
  if (!claim) return fail(res, 404, 'Claim not found');
  if (String(claim.claimedBy) !== String(req.user._id)) return fail(res, 403, 'Not authorized');
  if (claim.status !== 'pending') return fail(res, 409, `This claim was already ${claim.status}.`);
  claim.status = 'cancelled';
  await claim.save();
  res.json({ message: 'Claim withdrawn.', claim });
});
