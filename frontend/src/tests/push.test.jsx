import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import API from '../api/axios';
import {
  pushSupported, enablePush, disablePush, restorePush, detachPush, urlBase64ToUint8Array, isPushEnabledFor,
} from '../push/pushClient';

/* ------------------------------------------------------------------ */
/* service worker (public/sw.js), run against a fake worker environment */
/* ------------------------------------------------------------------ */
const SW_SOURCE = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

class FakeChannel {
  constructor() {
    this.port1 = { onmessage: null };
    this.port2 = { postMessage: (data) => this.port1.onmessage?.({ data }) };
  }
}

// A fake open tab. `answers` maps message type -> reply (omit = tab never answers).
function fakeTab(answers = {}) {
  return {
    postMessage: vi.fn((msg, ports) => { if (answers[msg.type] && ports?.[0]) ports[0].postMessage(answers[msg.type]); }),
    focus: vi.fn().mockResolvedValue(undefined),
  };
}

function loadWorker(tabs = []) {
  const handlers = {};
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: vi.fn(),
    clients: { matchAll: vi.fn().mockResolvedValue(tabs), claim: vi.fn(), openWindow: vi.fn().mockResolvedValue(undefined) },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
  };
  new Function('self', 'MessageChannel', SW_SOURCE)(self, FakeChannel);
  const fire = async (type, event) => {
    const waits = [];
    handlers[type]({ ...event, waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  };
  return { self, fire };
}
const pushEvent = (payload) => ({ data: { json: () => payload, text: () => JSON.stringify(payload) } });
const PAYLOAD = { title: 'New message', body: 'Aman wrote to you', url: '/messages/c1', tag: 'msg-c1', userId: 'riya' };

describe('service worker', () => {
  test('shows a notification when no tab is open', async () => {
    const { self, fire } = loadWorker([]);
    await fire('push', pushEvent(PAYLOAD));
    expect(self.registration.showNotification).toHaveBeenCalledWith('New message', expect.objectContaining({
      body: 'Aman wrote to you', tag: 'msg-c1', data: { url: '/messages/c1', userId: 'riya' },
    }));
  });

  test('stays quiet when a VISIBLE tab is already signed in as the recipient', async () => {
    const tab = fakeTab({ 'push-check': { userId: 'riya', visible: true } });
    const { self, fire } = loadWorker([tab]);
    await fire('push', pushEvent(PAYLOAD));
    expect(self.registration.showNotification).not.toHaveBeenCalled();
  });

  test('still notifies when the visible tab belongs to a DIFFERENT account (two people, one browser)', async () => {
    const tab = fakeTab({ 'push-check': { userId: 'aman', visible: true } });
    const { self, fire } = loadWorker([tab]);
    await fire('push', pushEvent(PAYLOAD));
    expect(self.registration.showNotification).toHaveBeenCalled();
  });

  test('still notifies when the recipient’s tab is in the background', async () => {
    const tab = fakeTab({ 'push-check': { userId: 'riya', visible: false } });
    const { self, fire } = loadWorker([tab]);
    await fire('push', pushEvent(PAYLOAD));
    expect(self.registration.showNotification).toHaveBeenCalled();
  });

  test('a tab that never answers does not block the notification', async () => {
    const { self, fire } = loadWorker([fakeTab({})]);
    await fire('push', pushEvent(PAYLOAD));
    expect(self.registration.showNotification).toHaveBeenCalled();
  });

  test('survives a payload that is not JSON', async () => {
    const { self, fire } = loadWorker([]);
    await fire('push', { data: { json: () => { throw new Error('bad'); }, text: () => 'plain text' } });
    expect(self.registration.showNotification).toHaveBeenCalledWith('Campus Lost & Found', expect.objectContaining({ body: 'plain text' }));
  });

  test('clicking focuses the tab that belongs to the recipient and tells it where to go', async () => {
    const other = fakeTab({ 'who-are-you': { userId: 'aman' } });
    const mine = fakeTab({ 'who-are-you': { userId: 'riya' } });
    const { self, fire } = loadWorker([other, mine]);
    const close = vi.fn();
    await fire('notificationclick', { notification: { close, data: { url: '/messages/c1', userId: 'riya' } } });
    expect(close).toHaveBeenCalled();
    expect(mine.focus).toHaveBeenCalled();
    expect(mine.postMessage).toHaveBeenCalledWith({ type: 'navigate', url: '/messages/c1' });
    expect(other.focus).not.toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  test('clicking with no tab for that person opens a new window', async () => {
    const other = fakeTab({ 'who-are-you': { userId: 'aman' } });
    const { self, fire } = loadWorker([other]);
    await fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/claims?tab=received', userId: 'riya' } } });
    expect(self.clients.openWindow).toHaveBeenCalledWith('/claims?tab=received');
    expect(other.focus).not.toHaveBeenCalled();
  });
});

/* ------------------------------ push client ------------------------------ */
const PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function installBrowserPush({ permission = 'default', requestResult = 'granted', existing = null } = {}) {
  const sub = existing || {
    endpoint: 'https://push.example/e1', toJSON: () => ({ endpoint: 'https://push.example/e1', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn().mockResolvedValue(true), options: { applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY).buffer },
  };
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(existing),
    subscribe: vi.fn().mockResolvedValue(sub),
  };
  const reg = { pushManager };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: vi.fn().mockResolvedValue(reg), ready: Promise.resolve(reg), getRegistration: vi.fn().mockResolvedValue(reg), addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  window.PushManager = function PushManager() {};
  window.Notification = { permission, requestPermission: vi.fn().mockResolvedValue(requestResult) };
  return { sub, pushManager, reg };
}
const removeBrowserPush = () => { delete navigator.serviceWorker; delete window.PushManager; delete window.Notification; };

describe('pushClient', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); API.get.mockResolvedValue({ data: { enabled: true, publicKey: PUBLIC_KEY } }); API.post.mockResolvedValue({ data: {} }); });
  afterEach(removeBrowserPush);

  test('reports unsupported browsers', () => {
    removeBrowserPush();
    expect(pushSupported()).toBe(false);
  });

  test('enable: asks permission, subscribes with the server key, registers it, remembers the choice per user', async () => {
    const { pushManager, sub } = installBrowserPush();
    await enablePush('riya');
    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    const opts = pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(opts.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(opts.applicationServerKey.length).toBe(65);
    expect(API.post).toHaveBeenCalledWith('/push/subscribe', { subscription: sub.toJSON() });
    expect(isPushEnabledFor('riya')).toBe(true);
    expect(isPushEnabledFor('aman')).toBe(false); // another account in the same browser is unaffected
  });

  test('enable: explains a blocked permission and stores nothing', async () => {
    installBrowserPush({ requestResult: 'denied' });
    await expect(enablePush('riya')).rejects.toThrow(/blocked/i);
    expect(API.post).not.toHaveBeenCalled();
    expect(isPushEnabledFor('riya')).toBe(false);
  });

  test('enable: explains when the server has push switched off', async () => {
    installBrowserPush();
    API.get.mockResolvedValue({ data: { enabled: false, publicKey: null } });
    await expect(enablePush('riya')).rejects.toThrow(/not set up/i);
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  test('enable: replaces an old browser subscription made with a different server key', async () => {
    const stale = { endpoint: 'https://push.example/old', toJSON: () => ({}), unsubscribe: vi.fn().mockResolvedValue(true), options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer } };
    const { pushManager } = installBrowserPush({ existing: stale });
    await enablePush('riya');
    expect(stale.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  test('disable: tells the server, and only drops the browser subscription when nobody else uses it', async () => {
    const { sub, pushManager } = installBrowserPush({ permission: 'granted' });
    pushManager.getSubscription.mockResolvedValue(sub);
    localStorage.setItem('push:riya', '1');

    API.post.mockResolvedValueOnce({ data: { remaining: 1 } }); // another account still uses this browser
    await disablePush('riya');
    expect(API.post).toHaveBeenCalledWith('/push/unsubscribe', { endpoint: sub.endpoint });
    expect(sub.unsubscribe).not.toHaveBeenCalled();
    expect(isPushEnabledFor('riya')).toBe(false);

    API.post.mockResolvedValueOnce({ data: { remaining: 0 } });
    await disablePush('riya');
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  test('restore: re-registers silently only for a user who opted in and has permission', async () => {
    installBrowserPush({ permission: 'granted' });
    expect(await restorePush('riya')).toBe(false); // never opted in
    localStorage.setItem('push:riya', '1');
    expect(await restorePush('riya')).toBe(true);
    expect(API.post).toHaveBeenCalledWith('/push/subscribe', expect.anything());
  });

  test('restore: does nothing when the browser permission was revoked', async () => {
    installBrowserPush({ permission: 'denied' });
    localStorage.setItem('push:riya', '1');
    expect(await restorePush('riya')).toBe(false);
    expect(API.post).not.toHaveBeenCalled();
  });

  test('detach (on sign-out): never throws and never hangs sign-out for long', async () => {
    const { sub, pushManager } = installBrowserPush({ permission: 'granted' });
    pushManager.getSubscription.mockResolvedValue(sub);
    API.post.mockImplementation(() => new Promise(() => {})); // a request that never finishes
    const started = Date.now();
    await detachPush();
    expect(Date.now() - started).toBeLessThan(3500);
  }, 6000);

  test('detach does nothing in browsers without push', async () => {
    removeBrowserPush();
    await expect(detachPush()).resolves.toBeUndefined();
  });
});

/* ------------------------------ UI controls ------------------------------ */
let pushState;
vi.mock('../context/PushContext', async () => {
  const actual = await vi.importActual('../context/PushContext');
  return { ...actual, usePush: () => pushState };
});
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
const mockToast = vi.fn();
import { PushPanel, PushPrompt } from '../components/PushControls';

const state = (over = {}) => ({
  supported: true, serverEnabled: true, permission: 'default', enabled: false, busy: false,
  enable: vi.fn().mockResolvedValue(), disable: vi.fn().mockResolvedValue(), sendTest: vi.fn().mockResolvedValue(), ...over,
});

describe('PushPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  test('explains unsupported browsers (incl. the iPhone Home Screen requirement)', () => {
    pushState = state({ supported: false });
    render(<PushPanel />);
    expect(screen.getByText(/Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Turn on/ })).not.toBeInTheDocument();
  });

  test('explains when the server has not enabled push', () => {
    pushState = state({ serverEnabled: false });
    render(<PushPanel />);
    expect(screen.getByText(/aren’t switched on/)).toBeInTheDocument();
  });

  test('explains how to unblock when the browser denied permission', () => {
    pushState = state({ permission: 'denied' });
    render(<PushPanel />);
    expect(screen.getByText(/blocked for this site/)).toBeInTheDocument();
  });

  test('"Turn on" enables and confirms; failures are surfaced as an error toast', async () => {
    const user = userEvent.setup();
    pushState = state();
    render(<PushPanel />);
    await user.click(screen.getByRole('button', { name: /Turn on notifications/ }));
    expect(pushState.enable).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/on for this device/), 'success');

    pushState = state({ enable: vi.fn().mockRejectedValue(new Error('Permission was not granted.')) });
    render(<PushPanel />);
    await user.click(screen.getAllByRole('button', { name: /Turn on notifications/ })[1]);
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Permission was not granted.', 'error'));
  });

  test('when on: shows status, can send a test and can turn off', async () => {
    const user = userEvent.setup();
    pushState = state({ enabled: true });
    render(<PushPanel />);
    expect(screen.getByText('On')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Send a test/ }));
    expect(pushState.sendTest).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Turn off/ }));
    expect(pushState.disable).toHaveBeenCalled();
  });
});

describe('PushPrompt', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  test('invites eligible users and never asks the browser by itself', async () => {
    pushState = state();
    render(<PushPrompt />);
    expect(screen.getByText('Don’t miss a reply')).toBeInTheDocument();
    expect(pushState.enable).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Turn on' }));
    expect(pushState.enable).toHaveBeenCalled();
  });

  test('dismissing hides it and remembers that', async () => {
    pushState = state();
    const { unmount } = render(<PushPrompt />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Don’t miss a reply')).not.toBeInTheDocument();
    unmount();
    render(<PushPrompt />);
    expect(screen.queryByText('Don’t miss a reply')).not.toBeInTheDocument();
  });

  test.each([
    ['unsupported browser', { supported: false }],
    ['push off on the server', { serverEnabled: false }],
    ['already enabled', { enabled: true }],
    ['permission denied', { permission: 'denied' }],
  ])('is hidden for: %s', (_label, over) => {
    pushState = state(over);
    render(<PushPrompt />);
    expect(screen.queryByText('Don’t miss a reply')).not.toBeInTheDocument();
  });
});
