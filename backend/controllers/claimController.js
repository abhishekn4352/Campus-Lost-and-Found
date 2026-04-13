const Claim = require('../models/Claim');
const Item = require('../models/Item');
const { generateOTP } = require('../utils/generateOTP');
const { sendOTPEmail } = require('../utils/sendOTP');

exports.requestClaim = async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item || item.status !== 'active')
      return res.status(400).json({ message: 'Item not available' });
    if (item.postedBy.toString() === req.user._id.toString())
      return res.status(400).json({ message: 'Cannot claim your own item' });

    const otp = generateOTP();
    const claim = await Claim.create({ itemId: item._id, claimedBy: req.user._id, otp });
    await sendOTPEmail(req.user.email, req.user.name, otp, item.title);
    res.status(201).json({ message: 'OTP sent to your email', claimId: claim._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.claimId);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    if (claim.claimedBy.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' });
    if (new Date() > claim.otpExpiresAt)
      return res.status(400).json({ message: 'OTP expired' });
    if (claim.otp !== req.body.otp)
      return res.status(400).json({ message: 'Invalid OTP' });

    claim.otpVerified = true;
    claim.status = 'approved';
    await claim.save();
    await Item.findByIdAndUpdate(claim.itemId, { status: 'claimed' });
    res.json({ message: 'Item claimed successfully!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyClaims = async (req, res) => {
  try {
    const claims = await Claim.find({ claimedBy: req.user._id })
      .populate('itemId', 'title type category imageUrl status');
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
