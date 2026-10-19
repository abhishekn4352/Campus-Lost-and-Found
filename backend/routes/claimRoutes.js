const router = require('express').Router();
const { requestClaim, getMyClaims, getReceivedClaims, respondToClaim, cancelClaim } = require('../controllers/claimController');
const { protect } = require('../middleware/authMiddleware');
const { claimLimiter } = require('../middleware/rateLimiters');

router.use(protect);

router.post('/request/:itemId', claimLimiter, requestClaim);
router.get('/my-claims', getMyClaims);
router.get('/received', getReceivedClaims);
router.put('/:id/respond', respondToClaim);
router.delete('/:id', cancelClaim);

module.exports = router;
