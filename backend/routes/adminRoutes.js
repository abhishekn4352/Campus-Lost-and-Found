const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const User = require('../models/User');

router.use(protect, adminOnly);

router.get('/dashboard', async (req, res) => {
  const [lost, found, claimed, expired, users, pendingClaims] = await Promise.all([
    Item.countDocuments({ type: 'lost', status: 'active' }),
    Item.countDocuments({ type: 'found', status: 'active' }),
    Item.countDocuments({ status: 'claimed' }),
    Item.countDocuments({ status: 'expired' }),
    User.countDocuments({ role: 'student' }),
    Claim.countDocuments({ status: 'pending' }),
  ]);
  res.json({ lost, found, claimed, expired, users, pendingClaims });
});

router.get('/items', async (req, res) => {
  const items = await Item.find().populate('postedBy', 'name email').sort('-createdAt');
  res.json(items);
});

router.delete('/items/:id', async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted by admin' });
});

router.get('/claims', async (req, res) => {
  const claims = await Claim.find()
    .populate('itemId', 'title type')
    .populate('claimedBy', 'name email')
    .sort('-createdAt');
  res.json(claims);
});

router.put('/claims/:id/approve', async (req, res) => {
  const claim = await Claim.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
  await Item.findByIdAndUpdate(claim.itemId, { status: 'claimed' });
  res.json({ message: 'Approved' });
});

router.put('/claims/:id/reject', async (req, res) => {
  await Claim.findByIdAndUpdate(req.params.id, { status: 'rejected' });
  res.json({ message: 'Rejected' });
});

router.get('/users', async (req, res) => {
  const users = await User.find({ role: 'student' }).select('-password').sort('-createdAt');
  res.json(users);
});

module.exports = router;
