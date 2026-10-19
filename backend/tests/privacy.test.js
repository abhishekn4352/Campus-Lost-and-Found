const { serializeConversation } = require('../utils/serializeConversation');

const ME = 'user-me';
const OTHER = 'user-other';

const conv = (meShared, otherShared) => ({
  _id: 'c1',
  participants: [
    { _id: ME, name: 'Me', email: 'me@college.edu', phone: '111' },
    { _id: OTHER, name: 'Other', email: 'other@college.edu', phone: '222' },
  ],
  shares: [{ userId: ME, shared: meShared }, { userId: OTHER, shared: otherShared }],
});

describe('serializeConversation — contact details must not leak before both people consent', () => {
  test.each([[false, false], [true, false], [false, true]])(
    'hides the other person\'s email and phone when shares are (me=%s, other=%s)',
    (meShared, otherShared) => {
      const out = serializeConversation(conv(meShared, otherShared), ME);
      const other = out.participants.find((p) => p._id === OTHER);
      expect(other).toEqual({ _id: OTHER, name: 'Other' });
      expect(JSON.stringify(out)).not.toContain('other@college.edu');
      expect(JSON.stringify(out)).not.toContain('222');
      expect(out.bothShared).toBe(false);
    }
  );

  test('reveals contact details once BOTH have shared', () => {
    const out = serializeConversation(conv(true, true), ME);
    const other = out.participants.find((p) => p._id === OTHER);
    expect(other.email).toBe('other@college.edu');
    expect(other.phone).toBe('222');
    expect(out.bothShared).toBe(true);
  });

  test('always includes my own details', () => {
    const me = serializeConversation(conv(false, false), ME).participants.find((p) => p._id === ME);
    expect(me.email).toBe('me@college.edu');
  });

  test('carries the unread count through', () => {
    expect(serializeConversation(conv(false, false), ME, 4).unreadCount).toBe(4);
  });
});
