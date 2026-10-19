jest.mock('../models/Claim');
jest.mock('../models/Item');
jest.mock('../models/User');
jest.mock('../models/Conversation');
jest.mock('../utils/sendOTP', () => ({
  sendClaimResultEmail: jest.fn().mockResolvedValue(true),
  sendClaimReceivedEmail: jest.fn().mockResolvedValue(true),
}));

const Claim = require('../models/Claim');
const Item = require('../models/Item');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { resolveClaim } = require('../services/claimService');
const { requestClaim } = require('../controllers/claimController');

const OWNER = '507f1f77bcf86cd799439011';
const CLAIMANT = '507f1f77bcf86cd799439012';
const STRANGER = '507f1f77bcf86cd799439099';
const ITEM_ID = '507f1f77bcf86cd799439021';
const CLAIM_ID = '507f1f77bcf86cd799439031';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const pendingClaim = (over = {}) => ({
  _id: CLAIM_ID, itemId: ITEM_ID, claimedBy: CLAIMANT, status: 'pending',
  save: jest.fn().mockResolvedValue(true), ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ name: 'Riya', email: 'riya@college.edu' }) });
  Conversation.findOne.mockResolvedValue(null);
  Conversation.create.mockResolvedValue({ _id: 'conv1' });
});

describe('resolveClaim — claims are reviewed by a person, never auto-approved', () => {
  test('owner approving flips the item to Claimed, rejects rival claims and opens a chat', async () => {
    const claim = pendingClaim();
    Claim.findById.mockResolvedValue(claim);
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, title: 'Blue wallet' });
    Item.findOneAndUpdate.mockResolvedValue({ _id: ITEM_ID, status: 'Claimed' });
    Claim.updateMany.mockResolvedValue({});

    const out = await resolveClaim({ claimId: CLAIM_ID, actor: { _id: OWNER, role: 'student' }, action: 'approve' });

    expect(Item.findOneAndUpdate).toHaveBeenCalledWith({ _id: ITEM_ID, status: 'Open' }, { status: 'Claimed' }, { new: true });
    expect(Claim.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: ITEM_ID, status: 'pending' }),
      expect.objectContaining({ status: 'rejected' })
    );
    expect(claim.status).toBe('approved');
    expect(out.conversationId).toBe('conv1');
  });

  test('a person who is neither the owner nor an admin gets 403', async () => {
    Claim.findById.mockResolvedValue(pendingClaim());
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, title: 'x' });
    await expect(resolveClaim({ claimId: CLAIM_ID, actor: { _id: STRANGER, role: 'student' }, action: 'approve' }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(Item.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('the claimant cannot approve their own claim', async () => {
    Claim.findById.mockResolvedValue(pendingClaim());
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, title: 'x' });
    await expect(resolveClaim({ claimId: CLAIM_ID, actor: { _id: CLAIMANT, role: 'student' }, action: 'approve' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  test('an admin may approve on behalf of the owner', async () => {
    const claim = pendingClaim();
    Claim.findById.mockResolvedValue(claim);
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, title: 'x' });
    Item.findOneAndUpdate.mockResolvedValue({ _id: ITEM_ID });
    await resolveClaim({ claimId: CLAIM_ID, actor: { _id: STRANGER, role: 'admin' }, action: 'approve' });
    expect(claim.status).toBe('approved');
  });

  test('an already-resolved claim cannot be resolved again (409)', async () => {
    Claim.findById.mockResolvedValue(pendingClaim({ status: 'rejected' }));
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, title: 'x' });
    await expect(resolveClaim({ claimId: CLAIM_ID, actor: { _id: OWNER, role: 'student' }, action: 'approve' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('approval fails (409) when the item is no longer Open — the atomic update matches nothing', async () => {
    const claim = pendingClaim();
    Claim.findById.mockResolvedValue(claim);
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, title: 'x' });
    Item.findOneAndUpdate.mockResolvedValue(null);
    await expect(resolveClaim({ claimId: CLAIM_ID, actor: { _id: OWNER, role: 'student' }, action: 'approve' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(claim.status).toBe('pending');
  });

  test('rejecting leaves the item Open', async () => {
    const claim = pendingClaim();
    Claim.findById.mockResolvedValue(claim);
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, title: 'x' });
    await resolveClaim({ claimId: CLAIM_ID, actor: { _id: OWNER, role: 'student' }, action: 'reject', note: 'Wrong colour' });
    expect(Item.findOneAndUpdate).not.toHaveBeenCalled();
    expect(claim.status).toBe('rejected');
    expect(claim.responseNote).toBe('Wrong colour');
  });
});

describe('requestClaim — validation', () => {
  const call = async (body, itemOverrides = {}, userId = CLAIMANT) => {
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, type: 'found', status: 'Open', title: 'Wallet', ...itemOverrides });
    Claim.findOne.mockResolvedValue(null);
    Claim.create.mockResolvedValue({ _id: 'cl1' });
    const res = mockRes();
    await requestClaim({ params: { itemId: ITEM_ID }, body, user: { _id: userId, name: 'Riya' } }, res);
    return res;
  };

  test('requires a real explanation of ownership', async () => {
    const res = await call({ message: 'mine' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Claim.create).not.toHaveBeenCalled();
  });

  test('creates a PENDING claim (not an approved one) for a valid request', async () => {
    const res = await call({ message: 'It has a green sticker inside and my library card.' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Claim.create).toHaveBeenCalledWith(expect.objectContaining({ claimedBy: CLAIMANT, itemId: ITEM_ID }));
  });

  test('lost items cannot be "claimed"', async () => {
    const res = await call({ message: 'I definitely found this one.' }, { type: 'lost' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('you cannot claim your own item', async () => {
    const res = await call({ message: 'This is obviously mine, I posted it.' }, {}, OWNER);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('closed/claimed items cannot be claimed', async () => {
    const res = await call({ message: 'It has my name written on it.' }, { status: 'Claimed' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('a second pending claim by the same person is a 409', async () => {
    Item.findById.mockResolvedValue({ _id: ITEM_ID, postedBy: OWNER, type: 'found', status: 'Open', title: 'x' });
    Claim.findOne.mockResolvedValue({ _id: 'existing' });
    const res = mockRes();
    await requestClaim({ params: { itemId: ITEM_ID }, body: { message: 'It has my initials on the back.' }, user: { _id: CLAIMANT, name: 'R' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
