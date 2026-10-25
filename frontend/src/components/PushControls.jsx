import { useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { usePush } from '../context/PushContext';
import { useToast } from '../context/ToastContext';
import Button from './Button';

const DISMISS_KEY = 'push-prompt-dismissed';

// Settings panel (Profile page).
export function PushPanel() {
  const { supported, serverEnabled, permission, enabled, busy, enable, disable, sendTest } = usePush();
  const { showToast } = useToast();

  const run = async (fn, okMessage) => {
    try { await fn(); if (okMessage) showToast(okMessage, 'success'); }
    catch (err) { showToast(err.message, 'error'); }
  };

  let body;
  if (!supported) {
    body = <p className="muted">This browser can’t show push notifications. On iPhone, add the site to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>;
  } else if (!serverEnabled) {
    body = <p className="muted">Push notifications aren’t switched on for this site yet. Ask the administrator to set them up.</p>;
  } else if (permission === 'denied' && !enabled) {
    body = <p className="muted">Notifications are blocked for this site in your browser. Allow them in the site settings (the lock icon next to the address), then come back and turn them on.</p>;
  } else {
    body = (
      <>
        <p className="muted" style={{ marginBottom: 16 }}>
          Get a notification on this device for new messages, claims on your items, and decisions on your claims — even when the site isn’t open.
          Messages are never shown in the notification, only who wrote and about which item.
        </p>
        <div className="row row-wrap">
          {enabled ? (
            <>
              <Button icon={BellOff} loading={busy} onClick={() => run(disable, 'Notifications turned off on this device.')}>Turn off</Button>
              <Button variant="ghost" icon={BellRing} onClick={() => run(sendTest, 'Test sent — it should arrive in a moment.')}>Send a test</Button>
            </>
          ) : (
            <Button variant="primary" icon={Bell} loading={busy} onClick={() => run(enable, 'Notifications are on for this device.')}>Turn on notifications</Button>
          )}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>This applies to this browser only, for the account signed in on this tab.</p>
      </>
    );
  }

  return (
    <section className="panel" aria-labelledby="push-h">
      <div className="row spread row-wrap" style={{ marginBottom: 8 }}>
        <h2 id="push-h" style={{ fontSize: '1.2rem' }}>Push notifications</h2>
        {supported && serverEnabled && <span className={`badge ${enabled ? 'badge-open' : 'badge-closed'}`}>{enabled ? 'On' : 'Off'}</span>}
      </div>
      {body}
    </section>
  );
}

// One-time, dismissible invitation (Dashboard). Never asks the browser for
// permission by itself — only when the person presses the button.
export function PushPrompt() {
  const { supported, serverEnabled, permission, enabled, busy, enable } = usePush();
  const { showToast } = useToast();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (!supported || !serverEnabled || enabled || permission === 'denied' || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };
  const turnOn = async () => {
    try { await enable(); showToast('Notifications are on for this device.', 'success'); }
    catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="push-prompt" role="region" aria-label="Notifications">
      <Bell size={22} aria-hidden="true" />
      <div className="grow">
        <strong>Don’t miss a reply</strong>
        <div className="muted" style={{ fontSize: '0.9rem' }}>Get notified about messages and claims, even when the site is closed.</div>
      </div>
      <Button size="sm" variant="primary" loading={busy} onClick={turnOn}>Turn on</Button>
      <button type="button" className="icon-btn" onClick={dismiss} aria-label="Dismiss"><X size={18} aria-hidden="true" /></button>
    </div>
  );
}
