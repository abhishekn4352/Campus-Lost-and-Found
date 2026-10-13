const router = require('express').Router();
const { requestClaim, verifyOTP, getMyClaims } = require('../controllers/claimController');
const { protect } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiters');

router.post('/request/:itemId', protect, requestClaim);
router.post('/verify-otp/:claimId', protect, loginLimiter, verifyOTP);
router.get('/my-claims', protect, getMyClaims);
module.exports = router;
