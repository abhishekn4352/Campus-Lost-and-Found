import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';
import { onSessionExpired } from '../utils/authEvents';

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
  // invalid cookie). Clear local state immediately so the Navbar and
  // every PrivateRoute react right away, instead of continuing to show a
  // "logged in" user whose requests are silently failing until they
  // happen to refresh the page.
  useEffect(() => {
    return onSessionExpired(() => setUser(null));
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await API.get('/auth/me');
      setUser(data);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await API.get('/auth/logout');
    } catch (err) {
      console.error('Logout request failed (clearing local session anyway)', err);
    } finally {
      // Logging out is fundamentally a client-side decision: whether or
      // not the server-side cookie-clear call succeeds, the app must
      // stop treating this browser as authenticated. Previously this
      // only ran on the success path, so a network hiccup during logout
      // left the Navbar/PrivateRoutes still showing the user as signed in.
      setUser(null);
    }
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
