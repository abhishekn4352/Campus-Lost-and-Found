const router = require('express').Router();
const { 
  register, 
  login, 
  loginWithOTP, 
  requestOTP, 
  logout, 
  getMe 
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/request-otp', requestOTP);
router.post('/register-verify', register);
router.post('/login', login);
router.post('/login-otp', loginWithOTP);
router.get('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;
