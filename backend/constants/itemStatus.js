// Single source of truth for Item.status values.
// Historically several files used a different (lowercase) scheme
// ('active' / 'claimed' / 'expired') which never matched the actual
// schema enum below, silently breaking Browse, Claims and Admin stats.
// Always import these constants instead of hardcoding status strings.

const ITEM_STATUS = Object.freeze({
  OPEN: 'Open',       // item is posted and available (default)
  CLAIMED: 'Claimed',  // owner has matched it with a claimant, pending handover
  CLOSED: 'Closed',    // item has been returned / handover complete / auto-expired
});

const ITEM_STATUS_VALUES = Object.values(ITEM_STATUS);

module.exports = { ITEM_STATUS, ITEM_STATUS_VALUES };
