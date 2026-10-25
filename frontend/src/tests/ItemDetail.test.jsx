import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ItemDetail from '../pages/ItemDetail';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import API from '../api/axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));

let auth;
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../context/NotificationsContext', () => ({ useNotifications: () => ({ refresh: vi.fn() }) }));
const mockToast = vi.fn();
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
let confirmResult = true;
vi.mock('../context/ConfirmContext', () => ({ useConfirm: () => vi.fn(async () => confirmResult) }));

const setUser = (user) => { auth = { user, isLoggedIn: () => !!user }; };
const item = (over = {}) => ({
  _id: 'i1', type: 'found', title: 'Black wallet', description: 'Green sticker on the back.', category: 'Wallet', location: 'Cafeteria',
  imageUrl: '', status: 'Open', lostFoundDate: '2026-10-10T00:00:00.000Z', expiresAt: '2026-11-10T00:00:00.000Z',
  postedBy: { _id: 'owner', name: 'Aman Verma' }, myClaim: null, ...over,
});
const renderDetail = () => render(
  <MemoryRouter initialEntries={['/items/i1']}><Routes><Route path="/items/:id" element={<ItemDetail />} /></Routes></MemoryRouter>
);

describe('ItemDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); confirmResult = true; setUser({ _id: 'me', name: 'Riya' }); });

  test('shows the item, the poster name, and nothing private', async () => {
    API.get.mockResolvedValue({ data: item() });
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Black wallet' })).toBeInTheDocument();
    expect(screen.getByText('Aman Verma')).toBeInTheDocument();
    expect(screen.getByText('Green sticker on the back.')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  test('a missing item shows a friendly message', async () => {
    API.get.mockRejectedValue({ response: { status: 404, data: { message: 'Item not found' } } });
    renderDetail();
    expect(await screen.findByText(/isn’t here any more/)).toBeInTheDocument();
  });

  test('signed-out visitors are asked to log in', async () => {
    setUser(null);
    API.get.mockResolvedValue({ data: item() });
    renderDetail();
    await screen.findByRole('heading', { name: 'Black wallet' });
    await userEvent.setup().click(screen.getByRole('button', { name: /Log in to continue/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: '/items/i1' } });
  });

  test('the owner sees management links instead of claim buttons', async () => {
    setUser({ _id: 'owner', name: 'Aman' });
    API.get.mockResolvedValue({ data: item() });
    renderDetail();
    await screen.findByRole('heading', { name: 'Black wallet' });
    expect(screen.getByText(/This is your post/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit post/ })).toHaveAttribute('href', '/items/i1/edit');
    expect(screen.queryByRole('button', { name: /claim it/ })).not.toBeInTheDocument();
  });

  test('claiming needs a real explanation, then posts it to the claims endpoint', async () => {
    API.get.mockResolvedValue({ data: item() });
    API.post.mockResolvedValue({ data: { claim: { _id: 'c1', status: 'pending' } } });
    const user = userEvent.setup();
    renderDetail();
    await user.click(await screen.findByRole('button', { name: /claim it/ }));

    await user.type(screen.getByLabelText(/How can you prove/), 'mine');
    await user.click(screen.getByRole('button', { name: 'Send claim' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 10/);
    expect(API.post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/How can you prove/));
    await user.type(screen.getByLabelText(/How can you prove/), 'Green sticker and my library card inside.');
    await user.click(screen.getByRole('button', { name: 'Send claim' }));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/claims/request/i1', { message: 'Green sticker and my library card inside.' }));
    expect(await screen.findByText(/waiting for the finder’s review/)).toBeInTheDocument();
  });

  test('an existing pending claim shows its status and a withdraw action', async () => {
    API.get.mockResolvedValue({ data: item({ myClaim: { _id: 'c9', status: 'pending' } }) });
    API.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderDetail();
    expect(await screen.findByText(/waiting for the finder’s review/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claim it/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Withdraw claim/ }));
    await waitFor(() => expect(API.delete).toHaveBeenCalledWith('/claims/c9'));
  });

  test('a rejected claim shows the finder’s note and allows trying again', async () => {
    API.get.mockResolvedValue({ data: item({ myClaim: { _id: 'c9', status: 'rejected', responseNote: 'Wrong colour' } }) });
    renderDetail();
    expect(await screen.findByText(/Wrong colour/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim it/ })).toBeInTheDocument();
  });

  test('a LOST item offers "I found this" (chat), never a claim', async () => {
    API.get.mockResolvedValue({ data: item({ type: 'lost' }) });
    API.post.mockResolvedValue({ data: { conversationId: 'cv1' } });
    const user = userEvent.setup();
    renderDetail();
    expect(screen.queryByRole('button', { name: /claim it/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /I found this/ }));
    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/messages/start', { itemId: 'i1' }));
    expect(mockNavigate).toHaveBeenCalledWith('/messages/cv1');
  });

  test('a matched item explains it is awaiting handover and offers no actions', async () => {
    API.get.mockResolvedValue({ data: item({ status: 'Claimed' }) });
    renderDetail();
    expect(await screen.findByText(/waiting for handover/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claim it/ })).not.toBeInTheDocument();
  });
});
