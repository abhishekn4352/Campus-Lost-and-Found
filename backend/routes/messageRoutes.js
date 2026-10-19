const express = require('express');
const router = express.Router();
const {
  startConversation, sendMessage, getConversations, getConversation, getMessages, shareContact,
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { messageLimiter } = require('../middleware/rateLimiters');

router.use(protect);

router.post('/start', startConversation);
router.post('/send', messageLimiter, sendMessage);
router.post('/share-contact', shareContact);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.get('/:convId', getMessages);

module.exports = router;
