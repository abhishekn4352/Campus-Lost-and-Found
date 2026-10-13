import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Profile from '../pages/Profile';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));
import API from '../api/axios';

const mockLogin = vi.fn();
const mockUser = { _id: 'u1', name: 'Riya Sharma', email: 'riya@college.edu', phone: '5551234567', collegeId: 'STU100', role: 'student' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, login: mockLogin }),
}));

const mockShowToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

describe('Profile page (new feature)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockImplementation((url) => {
      if (url === '/items/my-posts') return Promise.resolve({ data: [{ status: 'Open' }, { status: 'Closed' }] });
      if (url === '/claims/my-claims') return Promise.resolve({ data: [{ status: 'pending' }] });
      return Promise.resolve({ data: [] });
    });
  });

  test('pre-fills the form with the current user\'s name and phone', async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByLabelText('Full Name')).toHaveValue('Riya Sharma'));
    expect(screen.getByLabelText('Phone Number')).toHaveValue('5551234567');
  });

  test('shows the email and college ID as read-only', async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByDisplayValue('riya@college.edu')).toBeDisabled());
    expect(screen.getByDisplayValue('STU100')).toBeDisabled();
  });

  test('renders a real activity summary from existing endpoints', async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByText('Total Posts')).toBeInTheDocument());
    // 2 posts (1 Open + 1 Closed), 1 claim — from the mocked responses above.
    expect(screen.getAllByText('2')[0]).toBeInTheDocument();
  });

  test('saves valid changes and refreshes the shared user via login()', async () => {
    API.put.mockResolvedValue({ data: { ...mockUser, name: 'Riya S.', phone: '5559999999' } });
    const user = userEvent.setup();
    render(<Profile />);

    await waitFor(() => expect(screen.getByLabelText('Full Name')).toHaveValue('Riya Sharma'));
    await user.clear(screen.getByLabelText('Full Name'));
    await user.type(screen.getByLabelText('Full Name'), 'Riya S.');
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => expect(API.put).toHaveBeenCalledWith('/auth/profile', { name: 'Riya S.', phone: '5551234567' }));
    expect(mockLogin).toHaveBeenCalledWith({ ...mockUser, name: 'Riya S.', phone: '5559999999' });
    expect(mockShowToast).toHaveBeenCalledWith('Profile updated.', 'success');
  });

  test('rejects an invalid phone number before calling the API', async () => {
    const user = userEvent.setup();
    render(<Profile />);

    await waitFor(() => expect(screen.getByLabelText('Phone Number')).toHaveValue('5551234567'));
    await user.clear(screen.getByLabelText('Phone Number'));
    await user.type(screen.getByLabelText('Phone Number'), 'abc');
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid phone number/i);
    expect(API.put).not.toHaveBeenCalled();
  });
});
