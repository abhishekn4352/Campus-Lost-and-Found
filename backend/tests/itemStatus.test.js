const { ITEM_STATUS, ITEM_STATUS_VALUES } = require('../constants/itemStatus');

describe('ITEM_STATUS constants', () => {
  test('exposes exactly the three expected values', () => {
    expect(ITEM_STATUS_VALUES.sort()).toEqual(['Claimed', 'Closed', 'Open'].sort());
  });

  test('is frozen (cannot be mutated at runtime)', () => {
    expect(Object.isFrozen(ITEM_STATUS)).toBe(true);
    // Assignment to a frozen object's property is a silent no-op in
    // non-strict mode (CommonJS default) rather than a thrown error;
    // assert the value is unchanged either way.
    ITEM_STATUS.OPEN = 'tampered';
    expect(ITEM_STATUS.OPEN).toBe('Open');
  });

  test('no lowercase legacy values ("active"/"claimed"/"expired") are present', () => {
    expect(ITEM_STATUS_VALUES).not.toContain('active');
    expect(ITEM_STATUS_VALUES).not.toContain('expired');
    expect(ITEM_STATUS_VALUES).not.toContain('claimed'); // lowercase - only 'Claimed' (Title Case) is valid
  });
});
