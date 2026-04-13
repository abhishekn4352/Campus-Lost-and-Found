const router = require('express').Router();
const ctrl = require('../controllers/itemController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', ctrl.searchItems);
router.get('/my-posts', protect, ctrl.getMyPosts);
router.get('/', ctrl.getItems);
router.get('/:id', ctrl.getItem);
router.post('/', protect, ctrl.upload.single('image'), ctrl.createItem);
router.put('/:id', protect, ctrl.updateItem);
router.delete('/:id', protect, ctrl.deleteItem);
module.exports = router;
