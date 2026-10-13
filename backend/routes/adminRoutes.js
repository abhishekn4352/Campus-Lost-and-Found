const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const User = require('../models/User');
const { ITEM_STATUS } = require('../constants/itemStatus');

router.use(protect, adminOnly);

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [lost, found, claimed, expired, users, pendingClaims] = await Promise.all([
    Item.countDocuments({ type: 'lost', status: ITEM_STATUS.OPEN }),
    Item.countDocuments({ type: 'found', status: ITEM_STATUS.OPEN }),
    Item.countDocuments({ status: ITEM_STATUS.CLAIMED }),
    Item.countDocuments({ status: ITEM_STATUS.CLOSED, autoClosed: true }),
    User.countDocuments({ role: 'student' }),
    Claim.countDocuments({ status: 'pending' }),
  ]);
  res.json({ lost, found, claimed, expired, users, pendingClaims });
}));

router.get('/items', asyncHandler(async (req, res) => {
  const items = await Item.find().populate('postedBy', 'name email').sort('-createdAt');
  res.json(items);
}));

router.delete('/items/:id', asyncHandler(async (req, res) => {
  const item = await Item.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Item not found' });
  res.json({ message: 'Deleted by admin' });
}));

router.get('/claims', asyncHandler(async (req, res) => {
  const claims = await Claim.find()
    .populate({ path: 'itemId', select: 'title type postedBy', populate: { path: 'postedBy', select: 'name email' } })
    .populate('claimedBy', 'name email')
    .sort('-createdAt');
  res.json(claims);
}));

router.put('/claims/:id/approve', asyncHandler(async (req, res) => {
  const claim = await Claim.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
  if (!claim) return res.status(404).json({ message: 'Claim not found' });
  await Item.findByIdAndUpdate(claim.itemId, { status: ITEM_STATUS.CLAIMED });
  res.json({ message: 'Approved' });
}));

router.put('/claims/:id/reject', asyncHandler(async (req, res) => {
  const claim = await Claim.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
  if (!claim) return res.status(404).json({ message: 'Claim not found' });
  res.json({ message: 'Rejected' });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find({ role: 'student' }).select('-password').sort('-createdAt');
  res.json(users);
}));

module.exports = router;
