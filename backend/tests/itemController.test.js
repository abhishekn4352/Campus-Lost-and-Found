jest.mock('../models/Item');
jest.mock('../models/User');

const Item = require('../models/Item');
const User = require('../models/User');
const { updateItem, getPublicStats } = require('../controllers/itemController');
const { ITEM_STATUS } = require('../constants/itemStatus');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const OWNER_ID = '507f1f77bcf86cd799439011';

function buildItem(overrides = {}) {
  return {
    _id: 'item1',
    postedBy: { toString: () => OWNER_ID },
    title: 'Original title',
    status: ITEM_STATUS.OPEN,
    expiresAt: new Date('2099-01-01'),
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('itemController.updateItem (regression test for mass-assignment fix)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('ignores non-allowlisted fields such as postedBy and expiresAt', async () => {
    const item = buildItem();
    Item.findById.mockResolvedValue(item);

    const req = {
      params: { id: 'item1' },
      user: { _id: OWNER_ID },
      body: { title: 'New title', postedBy: 'someone-else', expiresAt: '2099-12-31' },
    };
    const res = mockRes();

    await updateItem(req, res);

    expect(item.title).toBe('New title'); // allowed field applied
    expect(item.postedBy.toString()).toBe(OWNER_ID); // NOT overwritten
    expect(item.expiresAt).toEqual(new Date('2099-01-01')); // NOT overwritten
    expect(item.save).toHaveBeenCalled();
  });

  test('rejects an invalid status value', async () => {
    const item = buildItem();
    Item.findById.mockResolvedValue(item);

    const req = { params: { id: 'item1' }, user: { _id: OWNER_ID }, body: { status: 'active' } };
    const res = mockRes();

    await updateItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(item.save).not.toHaveBeenCalled();
  });

  test('allows the legitimate Open -> Claimed -> Closed transition', async () => {
    const item = buildItem({ status: ITEM_STATUS.OPEN });
    Item.findById.mockResolvedValue(item);

    const req = { params: { id: 'item1' }, user: { _id: OWNER_ID }, body: { status: ITEM_STATUS.CLAIMED } };
    const res = mockRes();

    await updateItem(req, res);

    expect(item.status).toBe(ITEM_STATUS.CLAIMED);
    expect(item.save).toHaveBeenCalled();
  });

  test('rejects skipping a transition (Open -> Closed directly)', async () => {
    const item = buildItem({ status: ITEM_STATUS.OPEN });
    Item.findById.mockResolvedValue(item);

    const req = { params: { id: 'item1' }, user: { _id: OWNER_ID }, body: { status: ITEM_STATUS.CLOSED } };
    const res = mockRes();

    await updateItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(item.status).toBe(ITEM_STATUS.OPEN);
  });

  test('rejects updates from a non-owner', async () => {
    const item = buildItem();
    Item.findById.mockResolvedValue(item);

    const req = { params: { id: 'item1' }, user: { _id: 'someone-else-id' }, body: { title: 'Hijacked' } };
    const res = mockRes();

    await updateItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(item.title).toBe('Original title');
  });
});

describe('itemController.getPublicStats (real homepage numbers instead of hardcoded ones)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null for success rate / avg resolution time when the sample size is too small (avoids misleading "100%" from 1 data point)', async () => {
    Item.countDocuments.mockResolvedValueOnce(1); // reunited
    User.countDocuments.mockResolvedValue(3);
    Item.countDocuments.mockResolvedValueOnce(2); // everPosted
    Item.aggregate.mockResolvedValue([{ avgHours: 5 }]);

    const req = {};
    const res = mockRes();
    await getPublicStats(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.successRate).toBeNull();
    expect(payload.avgResolutionHours).toBeNull();
  });

  test('computes real success rate and avg resolution time once sample size is sufficient', async () => {
    Item.countDocuments.mockResolvedValueOnce(20); // reunited
    User.countDocuments.mockResolvedValue(50);
    Item.countDocuments.mockResolvedValueOnce(40); // everPosted
    Item.aggregate.mockResolvedValue([{ avgHours: 18.4 }]);

    const req = {};
    const res = mockRes();
    await getPublicStats(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.reunited).toBe(20);
    expect(payload.activeMembers).toBe(50);
    expect(payload.successRate).toBe(50); // 20/40 = 50%
    expect(payload.avgResolutionHours).toBe(18);
  });

  test('never throws when there are zero resolved items yet (empty aggregate result)', async () => {
    Item.countDocuments.mockResolvedValueOnce(0);
    User.countDocuments.mockResolvedValue(0);
    Item.countDocuments.mockResolvedValueOnce(0);
    Item.aggregate.mockResolvedValue([]); // no documents matched -> empty array, not [{avgHours: ...}]

    const req = {};
    const res = mockRes();
    await getPublicStats(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.reunited).toBe(0);
  });
});
