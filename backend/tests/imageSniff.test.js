const { detectImageType } = require('../utils/imageSniff');

const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('detectImageType (magic-byte check — filename/MIME alone can be faked)', () => {
  test('recognises JPEG', () => expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg'));
  test('recognises PNG', () => expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png'));
  test('recognises WEBP', () => {
    const buf = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
    expect(detectImageType(buf)).toBe('webp');
  });
  test('rejects an HTML file renamed to .jpg', () => {
    expect(detectImageType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
  });
  test('rejects empty / too-short input', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(null)).toBeNull();
  });
});
