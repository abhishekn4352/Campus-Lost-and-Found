const Claim = require('../models/Claim');
const Item = require('../models/Item');
const User = require('../models/User');
const { ITEM_STATUS } = require('../constants/itemStatus');
const { HttpError } = require('../utils/httpError');
const { findOrCreateConversation } = require('./conversationService');
const { sendClaimResultEmail } = require('../utils/sendOTP');
const { notifyUserSafe } = require('./pushService');

// Approve or reject a pending claim. Shared by the item owner's review
// screen and the admin panel, so both follow exactly the same rules.
async function resolveClaim({ claimId, actor, action, note = '' }) {
  if (!['approve', 'reject'].includes(action)) throw new HttpError(400, 'Action must be "approve" or "reject".');

  const claim = await Claim.findById(claimId);
  if (!claim) throw new HttpError(404, 'Claim not found');
  const item = await Item.findById(claim.itemId);
  if (!item) throw new HttpError(404, 'The item for this claim no longer exists.');

  const isOwner = String(item.postedBy) === String(actor._id);
  if (!isOwner && actor.role !== 'admin') throw new HttpError(403, 'Only the person who posted the item can respond to this claim.');
  if (claim.status !== 'pending') throw new HttpError(409, `This claim was already ${claim.status}.`);

  const now = new Date();
  let conversationId = null;
  const trimmedNote = String(note || '').trim().slice(0, 300);

  if (action === 'approve') {
    // Atomic: only one claim can ever flip an Open item to Claimed, even if
    // two approvals arrive at the same moment.
    const updated = await Item.findOneAndUpdate(
      { _id: item._id, status: ITEM_STATUS.OPEN },
      { status: ITEM_STATUS.CLAIMED },
      { new: true }
    );
    if (!updated) throw new HttpError(409, 'This item is no longer open, so the claim cannot be approved.');

    claim.status = 'approved';
    await Claim.updateMany(
      { itemId: item._id, _id: { $ne: claim._id }, status: 'pending' },
      { status: 'rejected', responseNote: 'Another claim for this item was approved.', respondedBy: actor._id, respondedAt: now }
    );
    const conv = await findOrCreateConversation(item._id, item.postedBy, claim.claimedBy);
    conversationId = conv._id;
  } else {
    claim.status = 'rejected';
  }

  claim.responseNote = trimmedNote;
  claim.respondedBy = actor._id;
  claim.respondedAt = now;
  await claim.save();

  // Tell the claimant — best effort; a mail outage must not undo the decision.
  User.findById(claim.claimedBy).select('name email').then((claimant) => {
    if (claimant) {
      notifyUserSafe(claimant._id, {
        title: action === 'approve' ? 'Your claim was approved' : 'Your claim wasn’t approved',
        body: `“${item.title}”`,
        url: action === 'approve' && conversationId ? `/messages/${conversationId}` : '/claims',
        tag: `claim-${claim._id}`,
        urgency: action === 'approve' ? 'high' : 'normal',
      });
      return sendClaimResultEmail(claimant.email, claimant.name, item.title, action === 'approve', trimmedNote);
    }
  }).catch((err) => console.error('Claim result email failed:', err.message));

  return { claim, conversationId };
}

module.exports = { resolveClaim };
