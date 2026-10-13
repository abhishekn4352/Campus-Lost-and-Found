import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ItemDetail from '../pages/ItemDetail';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
import API from '../api/axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'item123' }) };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'finder1' }, isLoggedIn: () => true }),
}));

const mockShowToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const OPEN_ITEM = {
  _id: 'item123',
  title: 'Blue Backpack',
  description: 'A blue backpack',
  type: 'found',
  category: 'Other',
  status: 'Open',
  location: 'Library',
  lostFoundDate: '2026-01-01',
  expiresAt: '2026-02-01',
  postedBy: { _id: 'owner1', name: 'Owner Person' },
};

function renderDetail() {
  return render(
    <MemoryRouter>
      <ItemDetail />
    </MemoryRouter>
  );
}

describe('ItemDetail — Request Claim entry point (regression test for the missing claim-flow trigger)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockImplementation((url) => {
      if (url === '/items/item123') return Promise.resolve({ data: OPEN_ITEM });
      return Promise.resolve({ data: [] });
    });
  });

  test('shows a Request Claim button for a non-owner viewing an Open item', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Blue Backpack')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Claim it/i })).toBeInTheDocument();
  });

  test('clicking Request Claim calls the claims endpoint and navigates to the OTP page with the returned claimId', async () => {
    API.post.mockResolvedValue({ data: { message: 'OTP sent', claimId: 'claim999' } });
    const user = userEvent.setup();
    renderDetail();

    await waitFor(() => expect(screen.getByText('Blue Backpack')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Claim it/i }));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/claims/request/item123'));
    expect(mockNavigate).toHaveBeenCalledWith('/verify-otp/claim999');
  });

  test('an existing pending claim redirects to that claim\'s OTP page instead of showing a dead-end error', async () => {
    API.post.mockRejectedValue({
      response: { status: 400, data: { message: 'You already have a pending claim for this item', claimId: 'existingClaim1' } },
    });
    const user = userEvent.setup();
    renderDetail();

    await waitFor(() => expect(screen.getByText('Blue Backpack')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Claim it/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/verify-otp/existingClaim1'));
  });
});
