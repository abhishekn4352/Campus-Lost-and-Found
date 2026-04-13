const Item = require('../models/Item');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
exports.upload = multer({ storage });

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
    const { type, category, location, status } = req.query;
    const filter = { status: status || 'Open' };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (location) filter.location = new RegExp(location, 'i');
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
    res.status(500).json({ message: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.postedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    Object.assign(item, req.body);
    await item.save();
    res.json(item);
  } catch (err) {
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
    const regex = new RegExp(req.query.q, 'i');
    const items = await Item.find({
      status: 'Open',
      $or: [{ title: regex }, { description: regex }, { location: regex }]
    }).sort('-createdAt');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
