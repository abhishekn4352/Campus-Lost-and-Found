import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
import API from '../api/axios';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1', name: 'Riya Sharma' } }) }));
let notes;
vi.mock('../context/NotificationsContext', () => ({ useNotifications: () => notes }));

const post = (over) => ({ _id: Math.random().toString(), type: 'lost', title: 'x', status: 'Open', category: 'Other', location: 'L', description: 'd', createdAt: new Date().toISOString(), ...over });
const renderDash = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notes = { unreadMessages: 0, claimsToReview: 0, myPendingClaims: 0 };
  });

  test('greets the user and summarises their posts by status', async () => {
    API.get.mockImplementation(async (url) => {
      if (url === '/items/my-posts') return { data: [post({ status: 'Open' }), post({ status: 'Open' }), post({ status: 'Claimed' }), post({ status: 'Closed' }), post({ status: 'Closed', autoClosed: true })] };
      return { data: { items: [post({ title: 'Latest umbrella', type: 'found' })] } };
    });
    renderDash();
    expect(screen.getByRole('heading', { name: 'Hi, Riya' })).toBeInTheDocument();
    expect(await screen.findByText('Latest umbrella')).toBeInTheDocument();
    const tile = (label) => screen.getByText(label).parentElement;
    expect(tile('Your open posts')).toHaveTextContent('2');
    expect(tile('Matched, awaiting handover')).toHaveTextContent('1');
    expect(tile('Returned')).toHaveTextContent('1'); // the auto-expired one is not a "return"
  });

  test('points to claims and messages that need attention', async () => {
    notes = { unreadMessages: 2, claimsToReview: 1, myPendingClaims: 0 };
    API.get.mockResolvedValue({ data: { items: [] } });
    API.get.mockImplementation(async (url) => (url === '/items/my-posts' ? { data: [] } : { data: { items: [] } }));
    renderDash();
    expect(await screen.findByRole('link', { name: /1 claim on your items needs a decision/ })).toHaveAttribute('href', '/claims?tab=received');
    expect(screen.getByRole('link', { name: /2 unread messages/ })).toHaveAttribute('href', '/messages');
  });

  test('shows an error with a retry instead of crashing', async () => {
    API.get.mockRejectedValueOnce({ response: { data: { message: 'Server down' } } });
    API.get.mockRejectedValueOnce({ response: { data: { message: 'Server down' } } });
    renderDash();
    expect(await screen.findByText('Server down')).toBeInTheDocument();

    API.get.mockImplementation(async (url) => (url === '/items/my-posts' ? { data: [] } : { data: { items: [] } }));
    await userEvent.setup().click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('Nothing has been posted yet.')).toBeInTheDocument();
  });
});
