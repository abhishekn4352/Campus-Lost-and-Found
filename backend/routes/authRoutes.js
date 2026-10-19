const router = require('express').Router();
const {
  register, login, loginWithOTP, requestOTP, resetPassword, changePassword,
  logout, getMe, updateProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { otpRequestLimiter, loginLimiter } = require('../middleware/rateLimiters');

router.post('/request-otp', otpRequestLimiter, requestOTP);
router.post('/register-verify', loginLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/login-otp', loginLimiter, loginWithOTP);
router.post('/reset-password', loginLimiter, resetPassword);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, loginLimiter, changePassword);

module.exports = router;
