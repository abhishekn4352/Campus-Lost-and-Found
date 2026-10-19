const fs = require('fs');
const path = require('path');
const Claim = require('../models/Claim');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { UPLOAD_DIR } = require('../config/paths');

async function removeImageFile(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  // basename() guarantees we can only ever delete inside the upload dir.
  const file = path.join(UPLOAD_DIR, path.basename(imageUrl));
  await fs.promises.unlink(file).catch(() => {});
}

// Deleting an item must not leave orphans behind: claims and chats that
// point at a missing item crash list/detail screens, and the image file
// would sit on disk forever.
async function purgeItem(item) {
  const convs = await Conversation.find({ itemId: item._id }).select('_id');
  const convIds = convs.map((c) => c._id);
  await Promise.all([
    Claim.deleteMany({ itemId: item._id }),
    Message.deleteMany({ conversationId: { $in: convIds } }),
    Conversation.deleteMany({ itemId: item._id }),
  ]);
  await item.deleteOne();
  await removeImageFile(item.imageUrl);
}

module.exports = { purgeItem, removeImageFile };
