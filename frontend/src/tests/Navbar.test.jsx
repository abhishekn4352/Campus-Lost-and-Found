import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));

let auth;
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
let notes;
vi.mock('../context/NotificationsContext', () => ({ useNotifications: () => notes }));
const mockToggleTheme = vi.fn();
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: mockToggleTheme }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const student = { _id: 'u1', name: 'Riya Sharma', email: 'riya@college.edu', role: 'student' };
const setAuth = (user, extra = {}) => {
  auth = { user, isLoggedIn: () => !!user, isAdmin: () => user?.role === 'admin', logout: vi.fn().mockResolvedValue(), ...extra };
};
const renderNav = (route = '/') => render(<MemoryRouter initialEntries={[route]}><Navbar /></MemoryRouter>);

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notes = { unreadMessages: 0, claimsToReview: 0, myPendingClaims: 0 };
  });

  test('signed out: shows login and sign-up, and no member links', () => {
    setAuth(null);
    renderNav();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My posts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
  });

  test('signed in: shows member links and the report button', () => {
    setAuth(student);
    renderNav();
    for (const name of ['Dashboard', 'Browse', 'My posts', 'Claims', 'Messages']) {
      expect(screen.getAllByRole('link', { name: new RegExp(`^${name}`) }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole('link', { name: /Report item/ }).length).toBeGreaterThan(0);
  });

  test('the Admin link is only shown to admins', () => {
    setAuth(student);
    const { unmount } = renderNav();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    unmount();
    setAuth({ ...student, role: 'admin' });
    renderNav();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  test('the bell combines unread messages and claims to review into one count', () => {
    setAuth(student);
    notes = { unreadMessages: 3, claimsToReview: 2, myPendingClaims: 1 };
    renderNav();
    expect(screen.getByRole('button', { name: /Notifications, 5 unread/ })).toBeInTheDocument();
  });

  test('the bell menu lists what needs attention, and says so when nothing does', async () => {
    const user = userEvent.setup();
    setAuth(student);
    notes = { unreadMessages: 1, claimsToReview: 2, myPendingClaims: 0 };
    const { unmount } = renderNav();
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(screen.getByRole('menuitem', { name: /1 unread message/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /2 claims to review/ })).toBeInTheDocument();
    unmount();

    notes = { unreadMessages: 0, claimsToReview: 0, myPendingClaims: 0 };
    renderNav();
    await user.click(screen.getByRole('button', { name: /Notifications/ }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  test('the Claims and Messages links carry their own counts', () => {
    setAuth(student);
    notes = { unreadMessages: 4, claimsToReview: 1, myPendingClaims: 2 };
    renderNav();
    expect(screen.getAllByRole('link', { name: /^Messages/ })[0]).toHaveTextContent('4');
    expect(screen.getAllByRole('link', { name: /^Claims/ })[0]).toHaveTextContent('3');
  });

  test('the current page is marked for assistive tech', () => {
    setAuth(student);
    renderNav('/my-posts');
    expect(screen.getAllByRole('link', { name: 'My posts' })[0]).toHaveAttribute('aria-current', 'page');
  });

  test('signing out calls logout and returns to the login page', async () => {
    const user = userEvent.setup();
    setAuth(student);
    renderNav();
    await user.click(screen.getByRole('button', { name: /Account menu/ }));
    await user.click(screen.getByRole('menuitem', { name: /Sign out/ }));
    expect(auth.logout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('the theme button toggles the theme', async () => {
    const user = userEvent.setup();
    setAuth(null);
    renderNav();
    await user.click(screen.getByRole('button', { name: /Switch to dark mode/ }));
    expect(mockToggleTheme).toHaveBeenCalled();
  });
});
