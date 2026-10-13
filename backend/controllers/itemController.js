const Item = require('../models/Item');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const { ITEM_STATUS, ITEM_STATUS_VALUES } = require('../constants/itemStatus');
const { escapeRegex } = require('../utils/escapeRegex');

// --- Multer config -------------------------------------------------------
// Restrict to the image formats the frontend actually offers via
// <input type="file" accept="image/*">, and cap size to prevent storage
// abuse / DoS via oversized uploads. Filenames are server-generated
// (timestamp + validated extension) so user input never reaches the
// filesystem path.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(null, true);
  }
  const err = new Error('Only JPG, JPEG, PNG and WEBP images are allowed');
  err.statusCode = 400;
  cb(err);
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 }
});

// --- Fields owners are allowed to edit on their own item -----------------
// Explicit allowlist prevents mass-assignment (e.g. postedBy, expiresAt,
// imageUrl, timestamps being overwritten via a crafted request body).
const EDITABLE_FIELDS = ['title', 'description', 'category', 'location', 'lostFoundDate'];

exports.createItem = async (req, res) => {
  try {
    const { type, title, description, category, location, lostFoundDate } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const item = await Item.create({
      postedBy: req.user._id, type, title, description,
      category, location, imageUrl, lostFoundDate
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getItems = async (req, res) => {
  try {
    const { type, category, location } = req.query;
    // Browse only ever shows Open, non-expired items. `status` is
    // intentionally NOT accepted from the client here — exposing every
    // status (including other users' Closed/Claimed items) is not a
    // legitimate browse use case, and previously the frontend sent an
    // incorrect literal ('active') that could never match anything.
    const filter = {
      status: ITEM_STATUS.OPEN,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
    };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (location) filter.location = new RegExp(escapeRegex(location), 'i');
    const items = await Item.find(filter)
      .populate('postedBy', 'name email phone')
      .sort('-createdAt');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('postedBy', 'name email phone');
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Item not found' });
    res.status(500).json({ message: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });

    // Apply only allowlisted descriptive fields.
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) item[field] = req.body[field];
    }

    // Status transitions are allowed, but only within the valid enum and
    // only in the forward direction the UI actually exposes
    // (Open -> Claimed -> Closed), enforced here rather than trusting
    // whatever string the client sends.
    if (req.body.status !== undefined) {
      const nextStatus = req.body.status;
      if (!ITEM_STATUS_VALUES.includes(nextStatus)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${ITEM_STATUS_VALUES.join(', ')}` });
      }
      const validTransitions = {
        [ITEM_STATUS.OPEN]: [ITEM_STATUS.CLAIMED],
        [ITEM_STATUS.CLAIMED]: [ITEM_STATUS.CLOSED],
        [ITEM_STATUS.CLOSED]: []
      };
      if (item.status !== nextStatus && !validTransitions[item.status]?.includes(nextStatus)) {
        return res.status(400).json({ message: `Cannot change status from ${item.status} to ${nextStatus}` });
      }
      item.status = nextStatus;
    }

    await item.save();
    res.json(item);
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (item.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Not found' });
    res.status(500).json({ message: err.message });
  }
};

exports.getMyPosts = async (req, res) => {
  try {
    const items = await Item.find({ postedBy: req.user._id }).sort('-createdAt');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.searchItems = async (req, res) => {
  try {
    const q = req.query.q || '';
    const regex = new RegExp(escapeRegex(q), 'i');
    const items = await Item.find({
      status: ITEM_STATUS.OPEN,
      $or: [{ title: regex }, { description: regex }, { location: regex }]
    }).sort('-createdAt');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Public, real aggregate stats for the homepage. No auth required
//          since nothing here is sensitive (counts only), and no
//          individual item/user data is exposed. Replaces the previous
//          hardcoded homepage numbers with real ones.
// @route   GET /api/items/stats
exports.getPublicStats = async (req, res) => {
  try {
    const [reunited, activeMembers, everPosted, avgResolutionAgg] = await Promise.all([
      // "Reunited" = owner-confirmed resolutions only (autoClosed items were
      // never actually claimed by anyone, so they shouldn't count as a win).
      Item.countDocuments({ status: ITEM_STATUS.CLOSED, autoClosed: { $ne: true } }),
      User.countDocuments({ isVerified: true }),
      Item.countDocuments({}),
      Item.aggregate([
        { $match: { status: ITEM_STATUS.CLOSED, autoClosed: { $ne: true } } },
        { $project: { resolutionHours: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60] } } },
        { $group: { _id: null, avgHours: { $avg: '$resolutionHours' } } }
      ])
    ]);

    // Success rate is only meaningful once there's a real sample size;
    // with too few posts it's misleadingly noisy (e.g. 1 of 1 = "100%").
    const successRate = everPosted >= 10 ? Math.round((reunited / everPosted) * 100) : null;
    // Same reasoning for average resolution time.
    const avgResolutionHours = reunited >= 5 ? Math.round(avgResolutionAgg[0]?.avgHours || 0) : null;

    res.json({ reunited, activeMembers, successRate, avgResolutionHours });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
