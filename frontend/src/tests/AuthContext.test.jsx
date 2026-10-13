import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { emitSessionExpired } from '../utils/authEvents';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn() },
}));
import API from '../api/axios';

function Probe() {
  const { user, isLoggedIn, logout, loading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="logged-in">{String(isLoggedIn())}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('a global session-expired event clears the logged-in user immediately (regression test for the stale-401 bug)', async () => {
    API.get.mockResolvedValue({ data: { name: 'Riya', role: 'student' } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('true'));
    expect(screen.getByTestId('user-name').textContent).toBe('Riya');

    // Simulate what the axios interceptor now does when any non-auth
    // request comes back 401 after the user was believed logged in.
    act(() => emitSessionExpired());

    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('false'));
  });

  test('logout clears local user state even when the /auth/logout network call fails (regression test)', async () => {
    API.get.mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: { name: 'Riya', role: 'student' } });
      if (url === '/auth/logout') return Promise.reject(new Error('network down'));
      return Promise.reject(new Error('unexpected call'));
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('true'));

    screen.getByRole('button', { name: 'logout' }).click();

    // Even though the network call to /auth/logout rejects, the app must
    // stop believing this browser is authenticated.
    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('false'));
  });

  test('checkAuth failure on mount (no session) leaves the user logged out without crashing', async () => {
    API.get.mockRejectedValue({ response: { status: 401 } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('logged-in').textContent).toBe('false');
  });
});
