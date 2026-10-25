import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';
import { onSessionExpired } from '../utils/authEvents';
import { getToken, setToken, clearToken } from '../utils/session';
import { detachPush } from '../push/pushClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // If any API call comes back 401 after we believed the user was
  // logged in, the session is no longer valid server-side (expired/
  // invalid or expired token). Clear local state immediately so the Navbar and
  // every PrivateRoute react right away, instead of continuing to show a
  // "logged in" user whose requests are silently failing until they
  // happen to refresh the page.
  useEffect(() => {
    return onSessionExpired(() => setUser(null));
  }, []);

  const checkAuth = async () => {
    // A brand-new tab has no token, so there is nothing to check — this tab
    // starts signed out even if another tab is signed in.
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await API.get('/auth/me');
      setUser(data);
    } catch (err) {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // `token` is supplied by the login/register responses; Profile calls
  // login(user) without it just to refresh the shared user object.
  const login = (userData, token) => {
    if (token) setToken(token);
    setUser(userData);
  };

  // Signing out only affects THIS tab: it forgets its own token. Other tabs
  // (possibly signed in as someone else) are untouched.
  const logout = async () => {
    // Stop notifications for THIS person on this browser (needs the token,
    // so it must happen before it is cleared). Bounded to 2s, never throws.
    await detachPush().catch(() => {});
    clearToken();
    setUser(null);
  };

  const isAdmin = () => user?.role === 'admin';
  const isLoggedIn = () => !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isLoggedIn, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
