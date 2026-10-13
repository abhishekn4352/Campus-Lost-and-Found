import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

// Mock the shared axios instance so no real network call is made.
vi.mock('../api/axios', () => ({
  default: { get: vi.fn() },
}));
import API from '../api/axios';

// Mock AuthContext so we control `user` without needing a real /auth/me call.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Riya', _id: 'u1', role: 'student' } }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard (regression test for the loading/setLoading crash)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows a loading spinner first, then renders successfully with data', async () => {
    API.get.mockImplementation((url) => {
      if (url === '/items/my-posts') return Promise.resolve({ data: [{ status: 'Open' }, { status: 'Closed' }] });
      if (url === '/items?limit=5') return Promise.resolve({ data: [] });
      if (url === '/messages/conversations') return Promise.resolve({ data: [{ unreadCount: 2 }] });
      return Promise.resolve({ data: [] });
    });

    renderDashboard();

    // Loading state first — this line alone would previously throw
    // "loading is not defined" before the component could even mount.
    expect(screen.getByText(/Loading your dashboard/i)).toBeInTheDocument();

    // Then the success state, once data resolves.
    await waitFor(() => expect(screen.getByText(/Welcome back, Riya/i)).toBeInTheDocument());
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  test('shows a visible error message when the API calls fail, instead of crashing', async () => {
    API.get.mockRejectedValue(new Error('Network error'));

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByText(/Could not load your dashboard/i)).toBeInTheDocument()
    );
    // The page shell should still render around the error — it should not
    // have crashed the whole tree.
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  test('renders an empty/zero state gracefully when there is no data yet', async () => {
    API.get.mockResolvedValue({ data: [] });

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    // No error banner should be shown for a legitimately empty account.
    expect(screen.queryByText(/Could not load your dashboard/i)).not.toBeInTheDocument();
  });
});
