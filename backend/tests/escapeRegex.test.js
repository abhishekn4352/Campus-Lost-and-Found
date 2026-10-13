const { escapeRegex } = require('../utils/escapeRegex');

describe('escapeRegex', () => {
  test('escapes all standard regex metacharacters', () => {
    const input = '.*+?^${}()|[]\\';
    const escaped = escapeRegex(input);
    // The escaped string, compiled as a regex, should match the exact
    // literal input and nothing else.
    const re = new RegExp(`^${escaped}$`);
    expect(re.test(input)).toBe(true);
  });

  test('a malicious/invalid pattern no longer throws when compiled', () => {
    const malicious = '(a+)+$'; // classic catastrophic-backtracking shape
    expect(() => new RegExp(escapeRegex(malicious), 'i')).not.toThrow();
  });

  test('plain alphanumeric input is unchanged', () => {
    expect(escapeRegex('Library Block A')).toBe('Library Block A');
  });

  test('handles empty/undefined input safely', () => {
    expect(escapeRegex('')).toBe('');
    expect(escapeRegex(undefined)).toBe('');
  });

  test('an unbalanced bracket no longer crashes RegExp construction', () => {
    // Before the fix, `new RegExp(userInput)` with input like "[" would
    // throw a SyntaxError, causing a 500 on /items/search and /items.
    expect(() => new RegExp(escapeRegex('['), 'i')).not.toThrow();
    expect(() => new RegExp(escapeRegex('('), 'i')).not.toThrow();
  });
});
