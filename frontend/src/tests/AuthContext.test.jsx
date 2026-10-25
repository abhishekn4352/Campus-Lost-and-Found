import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { emitSessionExpired } from '../utils/authEvents';
import { getToken, setToken, clearToken } from '../utils/session';

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
import API from '../api/axios';

function Probe() {
  const { user, isLoggedIn, logout, login, loading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="logged-in">{String(isLoggedIn())}</div>
      <div data-testid="user-name">{user?.name || 'none'}</div>
      <button onClick={logout}>logout</button>
      <button onClick={() => login({ name: 'Aman' }, 'new-token')}>login</button>
    </div>
  );
}
const renderProbe = () => render(<AuthProvider><Probe /></AuthProvider>);

describe('AuthContext (per-tab sessions)', () => {
  beforeEach(() => { vi.clearAllMocks(); clearToken(); });

  test('a fresh tab (no token) starts signed out WITHOUT calling the API — other tabs’ logins are invisible to it', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('logged-in').textContent).toBe('false');
    expect(API.get).not.toHaveBeenCalled();
  });

  test('a tab that has its own token restores that tab’s user', async () => {
    setToken('tab-token');
    API.get.mockResolvedValue({ data: { name: 'Riya', role: 'student' } });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('true'));
    expect(screen.getByTestId('user-name').textContent).toBe('Riya');
    expect(API.get).toHaveBeenCalledWith('/auth/me');
  });

  test('login() stores the token for this tab; logout() forgets it', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    act(() => screen.getByRole('button', { name: 'login' }).click());
    expect(getToken()).toBe('new-token');
    expect(screen.getByTestId('user-name').textContent).toBe('Aman');
    act(() => screen.getByRole('button', { name: 'logout' }).click());
    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('false'));
    expect(getToken()).toBeFalsy();
  });

  test('a rejected stored token (expired/suspended) is discarded and the tab is signed out', async () => {
    setToken('stale');
    API.get.mockRejectedValue({ response: { status: 401 } });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('logged-in').textContent).toBe('false');
    expect(getToken()).toBeFalsy();
  });

  test('a global session-expired event clears the logged-in user immediately', async () => {
    setToken('tab-token');
    API.get.mockResolvedValue({ data: { name: 'Riya', role: 'student' } });
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('true'));
    act(() => emitSessionExpired());
    await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('false'));
  });
});
