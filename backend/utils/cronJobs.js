const cron = require('node-cron');
const Item = require('../models/Item');
const { ITEM_STATUS } = require('../constants/itemStatus');

// Daily job: any Item still Open past its expiresAt date is auto-closed.
// We reuse the existing "Closed" status (rather than inventing a
// contradictory/parallel "Expired" state) and flag it with `autoClosed:
// true` so it can still be distinguished from an owner-driven "Mark as
// Returned" closure (e.g. for the Admin "Expired" stat card).
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
