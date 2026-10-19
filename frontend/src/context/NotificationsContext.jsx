import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API from '../api/axios';
import { useAuth } from './AuthContext';

const EMPTY = { unreadMessages: 0, claimsToReview: 0, myPendingClaims: 0 };
const NotificationsContext = createContext({ ...EMPTY, refresh: () => {} });

const POLL_MS = 20000;

// One shared, lightweight poll for the navbar badges and dashboard — the
// server answers with three numbers, not whole conversation/claim lists.
// Polling pauses while the tab is hidden.
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(EMPTY);
  const loggedIn = !!user;

  const refresh = useCallback(async () => {
    try {
      const { data } = await API.get('/notifications/summary');
      setSummary({ ...EMPTY, ...data });
    } catch {
      /* badges are best-effort */
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) { setSummary(EMPTY); return undefined; }
    refresh();
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [loggedIn, refresh]);

  const value = useMemo(() => ({ ...summary, refresh }), [summary, refresh]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
