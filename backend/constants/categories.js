// Single source of truth for item categories (model validation, API
// filtering). The frontend keeps a matching list in src/constants.js.
const CATEGORIES = Object.freeze(['Electronics', 'Books', 'ID Card', 'Keys', 'Wallet', 'Clothing', 'Sports', 'Other']);
module.exports = { CATEGORIES };
