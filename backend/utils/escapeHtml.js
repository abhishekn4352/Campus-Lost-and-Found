// User-controlled strings (names, item titles) are interpolated into HTML
// emails. Without escaping, a title like <a href="evil">…</a> becomes a
// phishing link inside an email that comes from OUR address.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => MAP[c]);
module.exports = { escapeHtml };
