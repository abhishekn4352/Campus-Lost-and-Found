jest.mock('../models/Conversation');
jest.mock('../models/Message');
jest.mock('../models/Item');
jest.mock('../models/User');

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { getMessages, shareContact } = require('../controllers/messageController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const OWNER_ID = '507f1f77bcf86cd799439011';
const OTHER_PARTICIPANT_ID = '507f1f77bcf86cd799439012';
const INTRUDER_ID = '507f1f77bcf86cd799439099';
const CONV_ID = '507f1f77bcf86cd799439033';

function buildConversation() {
  return {
    _id: CONV_ID,
    participants: [OWNER_ID, OTHER_PARTICIPANT_ID],
    shares: [
      { userId: OWNER_ID, shared: false },
      { userId: OTHER_PARTICIPANT_ID, shared: false },
    ],
    save: jest.fn().mockResolvedValue(true),
  };
}

describe('messageController authorization (regression test for IDOR fix)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getMessages returns 403 for a user who is not a participant', async () => {
    Conversation.findById.mockResolvedValue(buildConversation());
    const req = { params: { convId: CONV_ID }, user: { _id: INTRUDER_ID } };
    const res = mockRes();

    await getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Message.find).not.toHaveBeenCalled();
  });

  test('getMessages returns 404 when the conversation does not exist', async () => {
    Conversation.findById.mockResolvedValue(null);
    const req = { params: { convId: CONV_ID }, user: { _id: OWNER_ID } };
    const res = mockRes();

    await getMessages(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('getMessages succeeds for an actual participant', async () => {
    Conversation.findById.mockResolvedValue(buildConversation());
    Message.updateMany.mockResolvedValue({});
    Message.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([{ content: 'hi' }]) });
    const req = { params: { convId: CONV_ID }, user: { _id: OTHER_PARTICIPANT_ID } };
    const res = mockRes();

    await getMessages(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith([{ content: 'hi' }]);
  });

  test('shareContact returns 403 for a non-participant', async () => {
    Conversation.findById.mockResolvedValue(buildConversation());
    const req = { body: { conversationId: CONV_ID }, user: { _id: INTRUDER_ID } };
    const res = mockRes();

    await shareContact(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('shareContact succeeds for an actual participant', async () => {
    const conv = buildConversation();
    Conversation.findById.mockResolvedValue(conv);
    const req = { body: { conversationId: CONV_ID }, user: { _id: OWNER_ID } };
    const res = mockRes();

    await shareContact(req, res);

    expect(conv.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalled();
  });
});
