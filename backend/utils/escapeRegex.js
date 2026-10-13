// Escapes RegExp special characters so user-supplied search/filter text
// can be safely used inside `new RegExp(...)` without regex-injection or
// pathological-backtracking (ReDoS) risk.
function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
