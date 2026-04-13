const express = require('express');
const router = express.Router();
const { sendMessage, getConversations, getMessages, shareContact } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/send', sendMessage);
router.get('/conversations', getConversations);
router.get('/:convId', getMessages);
router.post('/share-contact', shareContact);

module.exports = router;
