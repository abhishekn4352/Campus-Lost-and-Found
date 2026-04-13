const cron = require('node-cron');
const Item = require('../models/Item');

cron.schedule('0 0 * * *', async () => {
  const result = await Item.updateMany(
    { status: 'active', expiresAt: { $lt: new Date() } },
    { status: 'expired' }
  );
  console.log(`[CRON] Expired ${result.modifiedCount} items`);
});
