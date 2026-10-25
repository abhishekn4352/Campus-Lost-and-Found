import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Profile from '../pages/Profile';

vi.mock('../api/axios', () => ({ default: { put: vi.fn() } }));
import API from '../api/axios';

const mockLogin = vi.fn();
const currentUser = { _id: 'u1', name: 'Riya Sharma', email: 'riya@college.edu', phone: '98765 43210', collegeId: 'STU2041', role: 'student' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: currentUser, login: mockLogin }) }));
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
const mockToast = vi.fn();
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));

describe('Profile page', () => {
  beforeEach(() => vi.clearAllMocks());

  test('pre-fills the editable fields and locks email and college ID', () => {
    render(<Profile />);
    expect(screen.getByLabelText('Full name')).toHaveValue('Riya Sharma');
    expect(screen.getByLabelText('Phone number')).toHaveValue('98765 43210');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('College ID')).toBeDisabled();
  });

  test('"Save changes" stays disabled until something changes', async () => {
    const user = userEvent.setup();
    render(<Profile />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await user.type(screen.getByLabelText('Full name'), 'a');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  test('saves trimmed changes and refreshes the shared user', async () => {
    API.put.mockResolvedValue({ data: { ...currentUser, name: 'Riya S' } });
    const user = userEvent.setup();
    render(<Profile />);
    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), '  Riya S  ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(API.put).toHaveBeenCalledWith('/auth/profile', { name: 'Riya S', phone: '98765 43210' }));
    expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({ name: 'Riya S' }));
  });

  test('rejects an invalid phone number before calling the API', async () => {
    const user = userEvent.setup();
    render(<Profile />);
    await user.clear(screen.getByLabelText('Phone number'));
    await user.type(screen.getByLabelText('Phone number'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid phone/i);
    expect(API.put).not.toHaveBeenCalled();
  });

  test('changes the password with the current one, then clears the form', async () => {
    API.put.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(<Profile />);
    await user.type(screen.getByLabelText('Current password'), 'old-password');
    await user.type(screen.getByLabelText('New password'), 'new-password-1');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(API.put).toHaveBeenCalledWith('/auth/password', { currentPassword: 'old-password', newPassword: 'new-password-1' }));
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
  });

  test('refuses a new password shorter than 8 characters', async () => {
    const user = userEvent.setup();
    render(<Profile />);
    await user.type(screen.getByLabelText('Current password'), 'old-password');
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/);
    expect(API.put).not.toHaveBeenCalled();
  });

  test('shows the server error when the current password is wrong', async () => {
    API.put.mockRejectedValue({ response: { data: { message: 'Current password is incorrect.' } } });
    const user = userEvent.setup();
    render(<Profile />);
    await user.type(screen.getByLabelText('Current password'), 'nope-nope');
    await user.type(screen.getByLabelText('New password'), 'new-password-1');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.');
  });
});

describe('Profile — change email', () => {
  beforeEach(() => vi.clearAllMocks());

  test('two steps: password + new address sends a code, then the code confirms and refreshes the user', async () => {
    API.post = vi.fn()
      .mockResolvedValueOnce({ data: { email: 'new@college.edu' } })
      .mockResolvedValueOnce({ data: { user: { ...currentUser, email: 'new@college.edu' } } });
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(screen.getByRole('button', { name: 'Change email' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change email address' });

    await user.type(within(dialog).getByLabelText('New email address'), 'new@college.edu');
    await user.type(within(dialog).getByLabelText('Current password'), 'secret-pass');
    await user.click(within(dialog).getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/email/request', { newEmail: 'new@college.edu', password: 'secret-pass' }));

    await user.click(await within(dialog).findByLabelText('Digit 1 of 6'));
    await user.paste('424242');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm new email' }));
    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/email/confirm', { otp: '424242' }));
    expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@college.edu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('step 1 validates locally: bad address, same address, missing password', async () => {
    API.post = vi.fn();
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(screen.getByRole('button', { name: 'Change email' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('New email address'), 'nope');
    await user.click(within(dialog).getByRole('button', { name: 'Send code' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/valid email/i);

    await user.clear(within(dialog).getByLabelText('New email address'));
    await user.type(within(dialog).getByLabelText('New email address'), 'riya@college.edu');
    await user.click(within(dialog).getByRole('button', { name: 'Send code' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/already your email/i);

    await user.clear(within(dialog).getByLabelText('New email address'));
    await user.type(within(dialog).getByLabelText('New email address'), 'other@college.edu');
    await user.click(within(dialog).getByRole('button', { name: 'Send code' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/current password/i);
    expect(API.post).not.toHaveBeenCalled();
  });

  test('a wrong password from the server stays on step 1 with its message', async () => {
    API.post = vi.fn().mockRejectedValue({ response: { data: { message: 'Password is incorrect.' } } });
    const user = userEvent.setup();
    render(<Profile />);
    await user.click(screen.getByRole('button', { name: 'Change email' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('New email address'), 'new@college.edu');
    await user.type(within(dialog).getByLabelText('Current password'), 'bad');
    await user.click(within(dialog).getByRole('button', { name: 'Send code' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Password is incorrect.');
    expect(within(dialog).getByLabelText('New email address')).toBeInTheDocument();
  });
});
