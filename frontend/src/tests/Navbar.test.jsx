import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn() },
}));
import API from '../api/axios';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Riya Sharma', role: 'student' },
    isLoggedIn: () => true,
    isAdmin: () => false,
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

const mockShowToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
}

describe('Navbar notification bell (new: aggregates unread messages + pending claims)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows the combined badge count from unread messages and pending claims', async () => {
    API.get.mockImplementation((url) => {
      if (url === '/messages/conversations') return Promise.resolve({ data: [{ unreadCount: 2 }, { unreadCount: 1 }] });
      if (url === '/claims/my-claims') return Promise.resolve({ data: [{ status: 'pending' }, { status: 'approved' }] });
      return Promise.resolve({ data: [] });
    });

    renderNavbar();

    // 2+1 unread messages + 1 pending claim (the approved one doesn't count) = 4
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
  });

  test('shows no badge and a friendly empty state when there is nothing pending', async () => {
    API.get.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderNavbar();

    await waitFor(() => expect(screen.getByLabelText('Notifications')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  test('the account menu includes a link to the new Profile page', async () => {
    API.get.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderNavbar();

    await waitFor(() => expect(screen.getByText('Riya Sharma')).toBeInTheDocument());
    await user.click(screen.getByText('Riya Sharma'));

    expect(screen.getByRole('menuitem', { name: /Profile/i })).toBeInTheDocument();
  });

  test('My Claims nav link shows a pending-claims count, matching the existing Messages pattern', async () => {
    API.get.mockImplementation((url) => {
      if (url === '/claims/my-claims') return Promise.resolve({ data: [{ status: 'pending' }] });
      return Promise.resolve({ data: [] });
    });

    renderNavbar();

    await waitFor(() => expect(screen.getAllByText('My Claims (1)').length).toBeGreaterThan(0));
  });
});

describe('Navbar bottom nav (new: mobile one-tap access to core actions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockResolvedValue({ data: [] });
  });

  test('renders all 5 core destinations', async () => {
    renderNavbar();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument());
    const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(bottomNav).toHaveTextContent('Browse');
    expect(bottomNav).toHaveTextContent('Report');
    expect(bottomNav).toHaveTextContent('Chat');
    expect(bottomNav).toHaveTextContent('Claims');
    expect(bottomNav).toHaveTextContent('Profile');
  });

  test('the Report link points to /post-item and Profile to /profile', async () => {
    renderNavbar();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'Primary' }).querySelector('a[href="/post-item"]')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' }).querySelector('a[href="/profile"]')).toBeInTheDocument();
  });
});
