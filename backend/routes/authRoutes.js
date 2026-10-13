const router = require('express').Router();
const { 
  register, 
  login, 
  loginWithOTP, 
  requestOTP, 
  logout, 
  getMe,
  updateProfile
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { otpRequestLimiter, loginLimiter } = require('../middleware/rateLimiters');

router.post('/request-otp', otpRequestLimiter, requestOTP);
router.post('/register-verify', loginLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/login-otp', loginLimiter, loginWithOTP);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
