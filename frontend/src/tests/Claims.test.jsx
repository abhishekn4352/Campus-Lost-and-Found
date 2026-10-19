import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Claims from '../pages/Claims';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import API from '../api/axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));
const mockRefresh = vi.fn();
vi.mock('../context/NotificationsContext', () => ({ useNotifications: () => ({ claimsToReview: 1, myPendingClaims: 0, refresh: mockRefresh }) }));
const mockToast = vi.fn();
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
let confirmResult = true;
vi.mock('../context/ConfirmContext', () => ({ useConfirm: () => vi.fn(async () => confirmResult) }));

const itemRef = { _id: 'i1', title: 'Black wallet', type: 'found', category: 'Wallet', imageUrl: '', status: 'Open' };
const received = [
  { _id: 'c1', status: 'pending', message: 'Green sticker and my library card.', createdAt: new Date().toISOString(), itemId: itemRef, claimedBy: { _id: 'u9', name: 'Karan Mehta' } },
  { _id: 'c2', status: 'approved', message: 'Ink stain on the sleeve.', createdAt: new Date().toISOString(), itemId: { ...itemRef, _id: 'i2', title: 'Grey hoodie' }, claimedBy: { _id: 'u8', name: 'Sneha Rao' } },
];
const mine = [{ _id: 'c5', status: 'pending', message: 'It has my initials.', createdAt: new Date().toISOString(), itemId: itemRef }];

const renderClaims = (route) => render(<MemoryRouter initialEntries={[route]}><Claims /></MemoryRouter>);

describe('Claims page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmResult = true;
    API.get.mockImplementation(async (url) => ({ data: url === '/claims/my-claims' ? mine : received }));
  });

  test('"I claimed" lists my claims with a withdraw action', async () => {
    API.delete.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderClaims('/claims');
    expect(await screen.findByText('It has my initials.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Withdraw/ }));
    await waitFor(() => expect(API.delete).toHaveBeenCalledWith('/claims/c5'));
  });

  test('"On my items" shows each claimant with their explanation and Approve / Reject for pending ones only', async () => {
    renderClaims('/claims?tab=received');
    expect(await screen.findByText('Karan Mehta', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Green sticker and my library card.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Reject' })).toHaveLength(1);
  });

  test('approving confirms, calls the respond endpoint and opens the chat that was created', async () => {
    API.put.mockResolvedValue({ data: { conversationId: 'cv7' } });
    const user = userEvent.setup();
    renderClaims('/claims?tab=received');
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(API.put).toHaveBeenCalledWith('/claims/c1/respond', { action: 'approve' }));
    expect(mockNavigate).toHaveBeenCalledWith('/messages/cv7');
  });

  test('declining the confirmation approves nothing', async () => {
    confirmResult = false;
    const user = userEvent.setup();
    renderClaims('/claims?tab=received');
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(API.put).not.toHaveBeenCalled();
  });

  test('rejecting asks for an optional reason and sends it', async () => {
    API.put.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderClaims('/claims?tab=received');
    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Reason/), 'Wrong colour');
    await user.click(within(dialog).getByRole('button', { name: 'Reject claim' }));
    await waitFor(() => expect(API.put).toHaveBeenCalledWith('/claims/c1/respond', { action: 'reject', note: 'Wrong colour' }));
  });

  test('shows an error state when loading fails', async () => {
    API.get.mockRejectedValue({ response: { data: { message: 'Nope' } } });
    renderClaims('/claims');
    expect(await screen.findByText('Nope')).toBeInTheDocument();
  });
});
