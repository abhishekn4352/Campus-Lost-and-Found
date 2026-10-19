import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
