import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import OtpInput from '../components/OtpInput';
import Modal from '../components/Modal';
import { passwordStrength } from '../components/PasswordInput';
import { assetUrl } from '../utils/assets';
import { timeAgo, plural } from '../utils/format';

function OtpHarness({ onValue }) {
  const [v, setV] = useState('');
  return <OtpInput value={v} onChange={(x) => { setV(x); onValue?.(x); }} />;
}

describe('OtpInput', () => {
  test('renders six labelled boxes', () => {
    render(<OtpHarness />);
    expect(screen.getAllByLabelText(/Digit \d of 6/)).toHaveLength(6);
  });

  test('typing digits advances focus; non-digits are ignored', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<OtpHarness onValue={onValue} />);
    await user.click(screen.getByLabelText('Digit 1 of 6'));
    await user.keyboard('1a2');
    expect(onValue).toHaveBeenLastCalledWith('12');
    expect(screen.getByLabelText('Digit 3 of 6')).toHaveFocus();
  });

  test('pasting a full code fills every box', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<OtpHarness onValue={onValue} />);
    await user.click(screen.getByLabelText('Digit 1 of 6'));
    await user.paste('987 654');
    expect(onValue).toHaveBeenLastCalledWith('987654');
  });

  test('backspace clears the previous digit', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<OtpHarness onValue={onValue} />);
    await user.click(screen.getByLabelText('Digit 1 of 6'));
    await user.keyboard('123');
    await user.keyboard('{Backspace}');
    expect(onValue).toHaveBeenLastCalledWith('12');
  });
});

describe('Modal', () => {
  test('is an accessible dialog, focuses inside, and closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Modal title="Delete?" onClose={onClose}><button>Yes</button><button>No</button></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Delete?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  test('keeps Tab focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Modal title="Hi" onClose={() => {}}><button>First</button><button>Last</button></Modal>);
    await user.tab(); // First -> Last
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    await user.tab(); // wraps
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  test('clicking the backdrop closes it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Modal title="Hi" onClose={onClose}><button>OK</button></Modal>);
    await user.pointer({ keys: '[MouseLeft]', target: document.querySelector('.modal-backdrop') });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('helpers', () => {
  test('passwordStrength grows with length and variety', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('abcdefgh')).toBeGreaterThanOrEqual(1);
    expect(passwordStrength('Abcdefgh1234!')).toBe(4);
  });

  test('assetUrl keeps same-origin paths and passes absolute URLs through', () => {
    expect(assetUrl('')).toBeNull();
    expect(assetUrl('/uploads/a.jpg')).toMatch(/(https?:\/\/[^/]+)?\/uploads\/a\.jpg$/);
    expect(assetUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  test('timeAgo and plural', () => {
    expect(timeAgo(new Date())).toBe('Just now');
    expect(timeAgo(new Date(Date.now() - 3 * 3600000))).toBe('3h ago');
    expect(plural(1, 'claim')).toBe('1 claim');
    expect(plural(2, 'claim')).toBe('2 claims');
  });
});
