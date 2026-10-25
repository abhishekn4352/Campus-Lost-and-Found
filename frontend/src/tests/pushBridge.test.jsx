import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PushProvider } from '../context/PushContext';

vi.mock('../api/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { enabled: false } }), post: vi.fn() } }));
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));
let currentUser = { _id: 'riya' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));

let sw;
beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { _id: 'riya' };
  sw = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw });
  window.PushManager = function PushManager() {};
  window.Notification = { permission: 'default' };
});
afterEach(() => { delete navigator.serviceWorker; delete window.PushManager; delete window.Notification; });

// Simulates a message from the service worker, with a private reply port.
function fromWorker(data) {
  const reply = vi.fn();
  const event = Object.assign(new Event('message'), { data, ports: [{ postMessage: reply }] });
  act(() => { sw.dispatchEvent(event); });
  return reply;
}
const mount = () => render(<MemoryRouter><PushProvider><div /></PushProvider></MemoryRouter>);

describe('service worker ⇄ page bridge', () => {
  test('answers "who are you" with this TAB’s signed-in user', () => {
    mount();
    expect(fromWorker({ type: 'who-are-you' })).toHaveBeenCalledWith({ userId: 'riya' });
  });

  test('a signed-out tab answers with no user', () => {
    currentUser = null;
    mount();
    expect(fromWorker({ type: 'who-are-you' })).toHaveBeenCalledWith({ userId: null });
  });

  test('answers the push check with the user and whether the tab is visible', () => {
    mount();
    const reply = fromWorker({ type: 'push-check' });
    expect(reply).toHaveBeenCalledWith({ userId: 'riya', visible: document.visibilityState === 'visible' });
  });

  test('navigates to same-site paths the worker asks for', () => {
    mount();
    fromWorker({ type: 'navigate', url: '/messages/c1' });
    expect(mockNavigate).toHaveBeenCalledWith('/messages/c1');
  });

  test.each(['https://evil.example/phish', '//evil.example/x', 'javascript:alert(1)', 42, undefined])('refuses to navigate to %s', (url) => {
    mount();
    fromWorker({ type: 'navigate', url });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
