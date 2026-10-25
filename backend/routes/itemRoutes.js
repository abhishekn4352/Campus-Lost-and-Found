const router = require('express').Router();
const ctrl = require('../controllers/itemController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { createItemLimiter } = require('../middleware/rateLimiters');

router.get('/stats', ctrl.getPublicStats);
router.get('/search', ctrl.searchItems);
router.get('/my-posts', protect, ctrl.getMyPosts);
router.get('/', ctrl.getItems);
router.get('/:id', optionalAuth, ctrl.getItem);
router.post('/', protect, createItemLimiter, ctrl.upload.single('image'), ctrl.createItem);
// multipart (optional replacement photo) and plain JSON (status changes) both work
router.put('/:id', protect, ctrl.upload.single('image'), ctrl.updateItem);
router.delete('/:id', protect, ctrl.deleteItem);
module.exports = router;
