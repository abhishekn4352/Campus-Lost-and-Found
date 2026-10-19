const fs = require('fs');

// A file's declared MIME type / extension is just client-supplied text.
// Checking the actual leading bytes (magic numbers) stops someone from
// uploading e.g. an HTML or script file renamed to .jpg.
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function isRealImage(filePath) {
  let handle;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(12), 0, 12, 0);
    return detectImageType(buffer.slice(0, bytesRead)) !== null;
  } catch {
    return false;
  } finally {
    if (handle) await handle.close();
  }
}

module.exports = { detectImageType, isRealImage };
