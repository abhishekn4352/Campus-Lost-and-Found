const cron = require('node-cron');
const Item = require('../models/Item');
const User = require('../models/User');
const { ITEM_STATUS } = require('../constants/itemStatus');

// Daily job: any Item still Open past its expiresAt date is auto-closed.
// We reuse the existing "Closed" status (rather than inventing a parallel
// "Expired" state) and flag it with `autoClosed: true` so it can still be
// distinguished from an owner-driven "Mark as Returned" closure.
cron.schedule('0 0 * * *', async () => {
  try {
    const result = await Item.updateMany(
      { status: ITEM_STATUS.OPEN, expiresAt: { $lt: new Date() } },
      { status: ITEM_STATUS.CLOSED, autoClosed: true }
    );
    console.log(`[CRON] Auto-closed ${result.modifiedCount} expired item(s)`);
  } catch (err) {
    console.error('[CRON] Failed to auto-close expired items:', err.message);
  }
});

// Sign-up creates a placeholder user the moment an OTP is requested. People
// who never finish registering would leave those behind forever.
cron.schedule('30 0 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await User.deleteMany({ isVerified: false, createdAt: { $lt: cutoff } });
    console.log(`[CRON] Removed ${result.deletedCount} abandoned sign-up(s)`);
  } catch (err) {
    console.error('[CRON] Failed to clean up abandoned sign-ups:', err.message);
  }
});
