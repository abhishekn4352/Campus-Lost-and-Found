const Item = require('../models/Item');
const User = require('../models/User');
const Claim = require('../models/Claim');
const multer = require('multer');
const path = require('path');
const { ITEM_STATUS, ITEM_STATUS_VALUES } = require('../constants/itemStatus');
const { escapeRegex } = require('../utils/escapeRegex');
const { CATEGORIES } = require('../constants/categories');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { clean, isString, parsePagination, fail } = require('../utils/validators');
const { isRealImage } = require('../utils/imageSniff');
const { purgeItem, removeImageFile } = require('../services/itemCleanup');
const { UPLOAD_DIR } = require('../config/paths');

// --- Multer config -------------------------------------------------------
// Restrict to the image formats the frontend offers and cap size to prevent
// storage abuse / DoS. Filenames are server-generated (timestamp + validated
// extension) so user input never reaches the filesystem path. After upload,
// the real file header is also checked (see createItem) because MIME type
// and extension are client-supplied.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
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
  const err = new Error('Only JPG, PNG and WEBP images are allowed.');
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
const ITEM_TYPES = ['lost', 'found'];

// Validates the user-editable descriptive fields. Returns an error string
// or null. Only fields present in `body` are checked, so it serves both
// create (all required) and update (partial).
function validateItemFields(body, { requireAll = false } = {}) {
  const rules = {
    title: (v) => (clean(v).length < 3 ? 'Title must be at least 3 characters.' : clean(v).length > 100 ? 'Title must be 100 characters or fewer.' : null),
    description: (v) => (clean(v).length < 10 ? 'Description must be at least 10 characters.' : clean(v).length > 1000 ? 'Description must be 1000 characters or fewer.' : null),
    location: (v) => (!clean(v) ? 'Location is required.' : clean(v).length > 120 ? 'Location must be 120 characters or fewer.' : null),
    category: (v) => (!CATEGORIES.includes(v) ? 'Please choose a valid category.' : null),
    lostFoundDate: (v) => {
      const d = new Date(v);
      if (!isString(v) || Number.isNaN(d.getTime())) return 'Please enter a valid date.';
      if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return 'The date cannot be in the future.';
      return null;
    },
  };
  for (const [field, check] of Object.entries(rules)) {
    if (body[field] === undefined) {
      if (requireAll) return `${field === 'lostFoundDate' ? 'Date' : field[0].toUpperCase() + field.slice(1)} is required.`;
      continue;
    }
    const problem = check(body[field]);
    if (problem) return problem;
  }
  return null;
}

// Poster details are limited to the display name. Email and phone are only
// ever revealed inside a conversation when BOTH people choose to share.
const POSTER_PUBLIC_FIELDS = 'name';

exports.createItem = asyncHandler(async (req, res) => {
  const discardUpload = () => (req.file ? removeImageFile(`/uploads/${req.file.filename}`) : null);
  const { type } = req.body || {};

  if (!ITEM_TYPES.includes(type)) { await discardUpload(); return fail(res, 400, 'Choose whether the item is lost or found.'); }
  const problem = validateItemFields(req.body, { requireAll: true });
  if (problem) { await discardUpload(); return fail(res, 400, problem); }

  if (req.file && !(await isRealImage(req.file.path))) {
    await discardUpload();
    return fail(res, 400, 'That file is not a valid JPG, PNG or WEBP image.');
  }

  const { title, description, category, location, lostFoundDate } = req.body;
  const item = await Item.create({
    postedBy: req.user._id,
    type,
    title: clean(title),
    description: clean(description),
    category,
    location: clean(location),
    imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    lostFoundDate,
  });
  res.status(201).json(item);
});

// Shared filter for the public browse/search listing: only Open, not-yet-
// expired items. `status` is intentionally NOT accepted from the client.
function buildBrowseFilter(query) {
  const and = [
    { status: ITEM_STATUS.OPEN },
    { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
  ];
  if (ITEM_TYPES.includes(query.type)) and.push({ type: query.type });
  if (CATEGORIES.includes(query.category)) and.push({ category: query.category });
  if (isString(query.location) && query.location.trim()) {
    and.push({ location: new RegExp(escapeRegex(query.location.trim()), 'i') });
  }
  const q = isString(query.q) ? query.q.trim().slice(0, 80) : '';
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }, { location: rx }, { category: rx }] });
  }
  return { $and: and };
}

// @desc    Browse + search (one endpoint, so filters and search combine)
// @route   GET /api/items?q=&type=&category=&location=&sort=&page=&limit=
exports.getItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 48 });
  const filter = buildBrowseFilter(req.query);
  const sort = req.query.sort === 'oldest' ? 'createdAt' : '-createdAt';

  const [items, total] = await Promise.all([
    Item.find(filter).populate('postedBy', POSTER_PUBLIC_FIELDS).sort(sort).skip(skip).limit(limit),
    Item.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// Kept so older clients calling /items/search keep working.
exports.searchItems = exports.getItems;

exports.getItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id).populate('postedBy', POSTER_PUBLIC_FIELDS);
  if (!item) return fail(res, 404, 'Item not found');

  const payload = item.toObject();
  // For a signed-in viewer, include their own claim on this item so the page
  // can show "claim pending" instead of offering the form again.
  if (req.user) {
    const mine = await Claim.findOne({ itemId: item._id, claimedBy: req.user._id }).sort('-createdAt').select('status responseNote createdAt');
    payload.myClaim = mine || null;
  }
  res.json(payload);
});

exports.updateItem = asyncHandler(async (req, res) => {
  const discardUpload = () => (req.file ? removeImageFile(`/uploads/${req.file.filename}`) : null);

  const item = await Item.findById(req.params.id);
  if (!item) { await discardUpload(); return fail(res, 404, 'Item not found'); }
  if (item.postedBy.toString() !== req.user._id.toString()) { await discardUpload(); return fail(res, 403, 'Not authorized'); }

  // The request may be JSON (status changes) or multipart (edit form with
  // an optional replacement photo), so every value is validated as a string.
  const body = req.body || {};
  const problem = validateItemFields(body);
  if (problem) { await discardUpload(); return fail(res, 400, problem); }

  const wantsRemoveImage = body.removeImage === true || body.removeImage === 'true';
  const editsContent = EDITABLE_FIELDS.some((f) => body[f] !== undefined) || !!req.file || wantsRemoveImage;
  if (editsContent && item.status === ITEM_STATUS.CLOSED) {
    await discardUpload();
    return fail(res, 400, 'Closed posts can’t be edited.');
  }

  if (req.file && !(await isRealImage(req.file.path))) {
    await discardUpload();
    return fail(res, 400, 'That file is not a valid JPG, PNG or WEBP image.');
  }

  // Apply only allowlisted descriptive fields.
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) item[field] = isString(body[field]) ? body[field].trim() : body[field];
  }

  // Photo: replace, remove, or leave alone. The old file is deleted only
  // after the new state has been saved successfully.
  const previousImage = item.imageUrl;
  if (req.file) item.imageUrl = `/uploads/${req.file.filename}`;
  else if (wantsRemoveImage) item.imageUrl = '';

  // Status transitions are only allowed inside the workflow the UI exposes:
  //   Open -> Claimed -> Closed, plus Claimed -> Open (handover fell through).
  let leftOpen = false;
  if (body.status !== undefined) {
    const nextStatus = body.status;
    if (!ITEM_STATUS_VALUES.includes(nextStatus)) {
      await discardUpload();
      return fail(res, 400, `Invalid status. Must be one of: ${ITEM_STATUS_VALUES.join(', ')}`);
    }
    const validTransitions = {
      [ITEM_STATUS.OPEN]: [ITEM_STATUS.CLAIMED],
      [ITEM_STATUS.CLAIMED]: [ITEM_STATUS.CLOSED, ITEM_STATUS.OPEN],
      [ITEM_STATUS.CLOSED]: [],
    };
    if (item.status !== nextStatus && !validTransitions[item.status]?.includes(nextStatus)) {
      await discardUpload();
      return fail(res, 400, `Cannot change status from ${item.status} to ${nextStatus}`);
    }
    leftOpen = item.status === ITEM_STATUS.OPEN && nextStatus !== ITEM_STATUS.OPEN;
    item.status = nextStatus;
  }

  await item.save();
  if ((req.file || wantsRemoveImage) && previousImage && previousImage !== item.imageUrl) {
    await removeImageFile(previousImage);
  }

  // Once an item is no longer Open, nobody should be left waiting on a
  // claim that can never be approved.
  if (leftOpen) {
    await Claim.updateMany(
      { itemId: item._id, status: 'pending' },
      { status: 'rejected', responseNote: 'The poster marked this item as handled.', respondedAt: new Date() }
    );
  }
  res.json(item);
});

exports.deleteItem = asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) return fail(res, 404, 'Not found');
  if (item.postedBy.toString() !== req.user._id.toString()) return fail(res, 403, 'Not authorized');
  await purgeItem(item);
  res.json({ message: 'Deleted' });
});

// @desc    My own posts, each with the number of claims waiting for review
// @route   GET /api/items/my-posts
exports.getMyPosts = asyncHandler(async (req, res) => {
  const items = await Item.find({ postedBy: req.user._id }).sort('-createdAt').lean();
  const pending = await Claim.aggregate([
    { $match: { itemId: { $in: items.map((i) => i._id) }, status: 'pending' } },
    { $group: { _id: '$itemId', count: { $sum: 1 } } },
  ]);
  const byItem = new Map(pending.map((p) => [String(p._id), p.count]));
  res.json(items.map((i) => ({ ...i, pendingClaims: byItem.get(String(i._id)) || 0 })));
});

// @desc    Public, real aggregate stats for the homepage. No auth required
//          since nothing here is sensitive (counts only).
// @route   GET /api/items/stats
exports.getPublicStats = asyncHandler(async (req, res) => {
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

  // Only meaningful once there's a real sample size; with too few posts it's
  // misleadingly noisy (e.g. 1 of 1 = "100%").
  const successRate = everPosted >= 10 ? Math.round((reunited / everPosted) * 100) : null;
  const avgResolutionHours = reunited >= 5 ? Math.round(avgResolutionAgg[0]?.avgHours || 0) : null;

  res.json({ reunited, activeMembers, successRate, avgResolutionHours });
});
