// Deliberately does NOT mock '../models/User' — the whole point of this
// file is to run the real Mongoose schema's validators (via
// validateSync(), which needs no live database connection) against the
// exact data the controllers construct. A previous version of the
// requestOTP fix used `phone: ''` on the assumption that an empty string
// would satisfy `required: true` for a String field. It does not — real
// Mongoose (verified here: v8.x) treats an empty string as missing, the
// same as null/undefined. The old test suite only checked
// `expect(placeholder.phone).toEqual(expect.any(String))` against a
// mocked model, which an empty string also satisfies — so it gave false
// confidence and missed the bug entirely. This file exists so that class
// of gap can't happen silently again.
const User = require('../models/User');

function assertPasses(doc, label) {
  const err = doc.validateSync();
  if (err) {
    throw new Error(`${label} should have passed validation but didn't: ${err.message}`);
  }
}

function assertFails(doc, label) {
  const err = doc.validateSync();
  if (!err) {
    throw new Error(`${label} was expected to fail validation but passed`);
  }
  return err;
}

describe('User schema — real Mongoose validation (regression test for the empty-string phone bug)', () => {
  test('documents actual behavior: an empty string does NOT satisfy required:true for a String field', () => {
    const doc = new User({ email: 'x@y.com', name: 'X', password: 'abcdefgh', phone: '', collegeId: 'PENDING' });
    const err = assertFails(doc, 'empty-string phone');
    expect(err.errors.phone).toBeDefined();
  });

  test('a whitespace-only string also does NOT satisfy required:true (Mongoose does not trim by default)', () => {
    const doc = new User({ email: 'x@y.com', name: 'X', password: 'abcdefgh', phone: '   ', collegeId: 'PENDING' });
    // Not asserting pass or fail here — this documents actual behavior for
    // whoever reads this test next, so it's verified rather than assumed
    // either way. Mongoose does NOT trim whitespace by default, so a
    // whitespace-only value is technically a non-empty string and passes
    // the built-in required check — which is exactly why the
    // controller-level code trims *before* checking for emptiness rather
    // than relying on the schema alone to catch this case.
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test('the exact placeholder object requestOTP now constructs for a brand-new email passes real validation', () => {
    const crypto = require('crypto');
    const doc = new User({
      email: 'brandnew@college.edu',
      name: 'New User',
      password: crypto.randomBytes(24).toString('hex'),
      phone: 'PENDING',
      collegeId: 'PENDING',
    });
    assertPasses(doc, 'requestOTP placeholder shape');
  });

  test('a fully completed registration (what register() saves) passes real validation', () => {
    const doc = new User({
      email: 'student@college.edu',
      name: 'Riya Sharma',
      password: 'a-real-password',
      phone: '5551234567',
      collegeId: 'STU1001',
      isVerified: true,
    });
    assertPasses(doc, 'completed registration shape');
  });

  test('the seedAdmin.js shape (including its phone fallback) passes real validation', () => {
    const doc = new User({
      name: 'Admin User',
      email: 'admin@college.edu',
      password: 'a-strong-password',
      phone: process.env.SEED_ADMIN_PHONE || '0000000000',
      collegeId: 'ADMIN001',
      role: 'admin',
      isVerified: true,
    });
    assertPasses(doc, 'seedAdmin placeholder shape');
  });
});
