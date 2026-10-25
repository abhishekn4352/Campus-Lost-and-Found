const router = require('express').Router();
const { protect, SAFE_USER_FIELDS } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const User = require('../models/User');
const { ITEM_STATUS, ITEM_STATUS_VALUES } = require('../constants/itemStatus');
const { escapeRegex } = require('../utils/escapeRegex');
const { isString, parsePagination, fail } = require('../utils/validators');
const { purgeItem } = require('../services/itemCleanup');
const { resolveClaim } = require('../services/claimService');

router.use(protect, adminOnly);

const pageMeta = (total, page, limit) => ({ total, page, pages: Math.max(1, Math.ceil(total / limit)) });
const searchRegex = (q) => (isString(q) && q.trim() ? new RegExp(escapeRegex(q.trim().slice(0, 80)), 'i') : null);

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [lost, found, claimed, expired, returned, users, pendingClaims] = await Promise.all([
    Item.countDocuments({ type: 'lost', status: ITEM_STATUS.OPEN }),
    Item.countDocuments({ type: 'found', status: ITEM_STATUS.OPEN }),
    Item.countDocuments({ status: ITEM_STATUS.CLAIMED }),
    Item.countDocuments({ status: ITEM_STATUS.CLOSED, autoClosed: true }),
    Item.countDocuments({ status: ITEM_STATUS.CLOSED, autoClosed: { $ne: true } }),
    User.countDocuments({ role: 'student', isVerified: true }),
    Claim.countDocuments({ status: 'pending' }),
  ]);
  res.json({ lost, found, claimed, expired, returned, users, pendingClaims });
}));

router.get('/items', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  if (['lost', 'found'].includes(req.query.type)) filter.type = req.query.type;
  if (ITEM_STATUS_VALUES.includes(req.query.status)) filter.status = req.query.status;
  const rx = searchRegex(req.query.q);
  if (rx) {
    const posterIds = await User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id');
    filter.$or = [{ title: rx }, { category: rx }, { location: rx }, { postedBy: { $in: posterIds } }];
  }
  const [items, total] = await Promise.all([
    Item.find(filter).populate('postedBy', 'name email').sort('-createdAt').skip(skip).limit(limit),
    Item.countDocuments(filter),
  ]);
  res.json({ items, ...pageMeta(total, page, limit) });
}));

router.delete('/items/:id', asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) return fail(res, 404, 'Item not found');
  await purgeItem(item);
  res.json({ message: 'Deleted by admin' });
}));

router.get('/claims', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  if (['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) filter.status = req.query.status;
  const [claims, total] = await Promise.all([
    Claim.find(filter)
      .populate({ path: 'itemId', select: 'title type status postedBy', populate: { path: 'postedBy', select: 'name email' } })
      .populate('claimedBy', 'name email')
      .sort('-createdAt').skip(skip).limit(limit),
    Claim.countDocuments(filter),
  ]);
  res.json({ claims, ...pageMeta(total, page, limit) });
}));

const respond = (action) => asyncHandler(async (req, res) => {
  const { claim, conversationId } = await resolveClaim({
    claimId: req.params.id, actor: req.user, action, note: req.body?.note,
  });
  res.json({ message: action === 'approve' ? 'Approved' : 'Rejected', claim, conversationId });
});
router.put('/claims/:id/approve', respond('approve'));
router.put('/claims/:id/reject', respond('reject'));

router.get('/users', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { role: 'student', isVerified: true };
  const rx = searchRegex(req.query.q);
  if (rx) filter.$or = [{ name: rx }, { email: rx }, { collegeId: rx }];
  const [users, total] = await Promise.all([
    User.find(filter).select(SAFE_USER_FIELDS).sort('-createdAt').skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ users, ...pageMeta(total, page, limit) });
}));

// Suspend / reinstate a student account.
router.put('/users/:id/status', asyncHandler(async (req, res) => {
  if (typeof req.body?.isActive !== 'boolean') return fail(res, 400, 'isActive (true/false) is required.');
  const user = await User.findById(req.params.id);
  if (!user) return fail(res, 404, 'User not found');
  if (user.role === 'admin') return fail(res, 400, 'Admin accounts cannot be suspended here.');
  user.isActive = req.body.isActive;
  await user.save();
  res.json({ message: user.isActive ? 'Account reinstated' : 'Account suspended', user: { _id: user._id, isActive: user.isActive } });
}));

module.exports = router;
