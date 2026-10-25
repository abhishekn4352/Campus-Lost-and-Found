jest.mock('../models/Item');
jest.mock('../models/User');
jest.mock('../models/Claim');
jest.mock('../utils/imageSniff', () => ({ isRealImage: jest.fn() }));
jest.mock('../services/itemCleanup', () => ({ purgeItem: jest.fn(), removeImageFile: jest.fn().mockResolvedValue() }));

const Item = require('../models/Item');
const { isRealImage } = require('../utils/imageSniff');
const { removeImageFile } = require('../services/itemCleanup');
const { updateItem } = require('../controllers/itemController');

const mockRes = () => { const r = {}; r.status = jest.fn().mockReturnValue(r); r.json = jest.fn().mockReturnValue(r); return r; };
const ME = 'user-1';
const makeItem = (over = {}) => ({
  _id: 'i1', postedBy: ME, status: 'Open', title: 'Old title', description: 'Old description text', category: 'Other',
  location: 'Lab', imageUrl: '/uploads/old.png', save: jest.fn().mockResolvedValue(true), ...over,
});
const call = (item, body, file) => {
  Item.findById.mockResolvedValue(item);
  const res = mockRes();
  return updateItem({ params: { id: 'i1' }, user: { _id: ME }, body, file }, res).then(() => res);
};

beforeEach(() => { jest.clearAllMocks(); isRealImage.mockResolvedValue(true); });

describe('updateItem — editing a post', () => {
  test('owner can edit the descriptive fields', async () => {
    const item = makeItem();
    const res = await call(item, { title: 'New title', description: 'A longer, better description.', location: 'Library' });
    expect(item.title).toBe('New title');
    expect(item.location).toBe('Library');
    expect(item.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(item);
  });

  test('a replacement photo is stored and the OLD file is deleted only after saving', async () => {
    const order = [];
    const item = makeItem({ save: jest.fn(async () => { order.push('save'); }) });
    removeImageFile.mockImplementation(async () => { order.push('remove'); });
    await call(item, { title: 'New title' }, { filename: 'new.png', path: '/tmp/new.png' });
    expect(item.imageUrl).toBe('/uploads/new.png');
    expect(removeImageFile).toHaveBeenCalledWith('/uploads/old.png');
    expect(order).toEqual(['save', 'remove']);
  });

  test('removeImage clears the photo and deletes the file', async () => {
    const item = makeItem();
    await call(item, { removeImage: 'true' });
    expect(item.imageUrl).toBe('');
    expect(removeImageFile).toHaveBeenCalledWith('/uploads/old.png');
  });

  test('an invalid replacement file is rejected, discarded, and the post is untouched', async () => {
    isRealImage.mockResolvedValue(false);
    const item = makeItem();
    const res = await call(item, { title: 'New title' }, { filename: 'evil.jpg', path: '/tmp/evil.jpg' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(removeImageFile).toHaveBeenCalledWith('/uploads/evil.jpg');
    expect(removeImageFile).not.toHaveBeenCalledWith('/uploads/old.png');
    expect(item.save).not.toHaveBeenCalled();
    expect(item.imageUrl).toBe('/uploads/old.png');
  });

  test('validation failure discards the uploaded file too', async () => {
    const res = await call(makeItem(), { title: 'x' }, { filename: 'new.png', path: '/tmp/new.png' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(removeImageFile).toHaveBeenCalledWith('/uploads/new.png');
  });

  test('someone else cannot edit (403) and their upload is discarded', async () => {
    const item = makeItem({ postedBy: 'someone-else' });
    const res = await call(item, { title: 'Hijack' }, { filename: 'x.png', path: '/tmp/x.png' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(removeImageFile).toHaveBeenCalledWith('/uploads/x.png');
    expect(item.save).not.toHaveBeenCalled();
  });

  test('a CLOSED post cannot be edited', async () => {
    const item = makeItem({ status: 'Closed' });
    const res = await call(item, { title: 'Late edit' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(item.save).not.toHaveBeenCalled();
  });

  test('editing a Claimed post is still allowed (e.g. fix a typo before handover)', async () => {
    const item = makeItem({ status: 'Claimed' });
    const res = await call(item, { location: 'Library desk' });
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(item.save).toHaveBeenCalled();
  });

  test('the post type cannot be changed through an edit', async () => {
    const item = makeItem({ type: 'found' });
    await call(item, { type: 'lost', title: 'Still fine' });
    expect(item.type).toBe('found');
  });
});
