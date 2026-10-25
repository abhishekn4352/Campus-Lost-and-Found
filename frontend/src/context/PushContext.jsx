import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  pushSupported, getPushConfig, enablePush, disablePush, restorePush, isPushEnabledFor, sendTestPush,
} from '../push/pushClient';
import { getErrorMessage } from '../utils/errorMessage';

const PushContext = createContext({
  supported: false, serverEnabled: false, permission: 'unsupported', enabled: false, busy: false,
  enable: async () => {}, disable: async () => {}, sendTest: async () => {},
});

// Lets the service worker talk to the page: it asks "who are you / are you
// visible?" before showing a notification, and can ask this tab to open a
// page when a notification is clicked.
function useServiceWorkerBridge(user) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!pushSupported()) return undefined;
    const onMessage = (event) => {
      const msg = event.data || {};
      const userId = user?._id ? String(user._id) : null;
      if (msg.type === 'push-check') event.ports?.[0]?.postMessage({ userId, visible: document.visibilityState === 'visible' });
      else if (msg.type === 'who-are-you') event.ports?.[0]?.postMessage({ userId });
      // Only same-site paths are ever followed.
      else if (msg.type === 'navigate' && typeof msg.url === 'string' && /^\/(?!\/)/.test(msg.url)) navigate(msg.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [user, navigate]);
}

export function PushProvider({ children }) {
  const { user } = useAuth();
  const supported = pushSupported();
  const [serverEnabled, setServerEnabled] = useState(false);
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useServiceWorkerBridge(user);

  // Learn whether the server offers push, and restore this person's opt-in.
  useEffect(() => {
    let alive = true;
    if (!supported || !user) { setEnabled(false); return undefined; }
    (async () => {
      try {
        const cfg = await getPushConfig();
        if (!alive) return;
        setServerEnabled(!!cfg.enabled);
        setPermission(Notification.permission);
        if (cfg.enabled && isPushEnabledFor(user._id)) {
          const ok = await restorePush(user._id);
          if (alive) setEnabled(ok);
        } else if (alive) setEnabled(false);
      } catch { /* push is optional */ }
    })();
    return () => { alive = false; };
  }, [supported, user]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await enablePush(user._id);
      setEnabled(true);
      setPermission(Notification.permission);
    } catch (err) {
      setPermission(Notification.permission);
      throw new Error(err.response ? getErrorMessage(err) : err.message);
    } finally { setBusy(false); }
  }, [user]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePush(user._id);
      setEnabled(false);
    } finally { setBusy(false); }
  }, [user]);

  const sendTest = useCallback(async () => {
    try { await sendTestPush(); } catch (err) { throw new Error(getErrorMessage(err, 'Couldn’t send a test notification.')); }
  }, []);

  const value = useMemo(
    () => ({ supported, serverEnabled, permission, enabled, busy, enable, disable, sendTest }),
    [supported, serverEnabled, permission, enabled, busy, enable, disable, sendTest]
  );
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export const usePush = () => useContext(PushContext);
