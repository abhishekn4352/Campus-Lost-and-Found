import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register';

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}));
import API from '../api/axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockLogin = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

const mockShowToast = vi.fn();
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

async function goToStep2(user) {
  API.post.mockResolvedValueOnce({});
  await user.type(screen.getByPlaceholderText('you@college.edu'), 'newstudent@college.edu');
  await user.click(screen.getByRole('button', { name: /Send Verification Code/i }));
  await waitFor(() => expect(screen.getByText('Complete profile')).toBeInTheDocument());
}

describe('Register page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('step 1 requests an OTP with purpose="register" (regression test for the duplicate-account UX fix)', async () => {
    API.post.mockResolvedValue({});
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText('you@college.edu'), 'newstudent@college.edu');
    await user.click(screen.getByRole('button', { name: /Send Verification Code/i }));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/request-otp', {
      email: 'newstudent@college.edu',
      purpose: 'register',
    }));
  });

  test('shows the server\'s "already exists" message when requesting an OTP for a verified account', async () => {
    API.post.mockRejectedValue({ response: { status: 409, data: { message: 'An account with this email already exists. Please log in instead.' } } });
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByPlaceholderText('you@college.edu'), 'existing@college.edu');
    await user.click(screen.getByRole('button', { name: /Send Verification Code/i }));

    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
    // Must not silently advance to the OTP step for an account that will
    // never receive a usable OTP.
    expect(screen.queryByText('Complete profile')).not.toBeInTheDocument();
  });

  test('blocks submission when password and confirm password do not match', async () => {
    const user = userEvent.setup();
    renderRegister();
    await goToStep2(user);

    await user.type(screen.getByPlaceholderText('Enter 6-digit code'), '123456');
    await user.type(screen.getByPlaceholderText('John Doe'), 'New Student');
    await user.type(screen.getByPlaceholderText('Min 6 characters'), 'password1');
    await user.type(screen.getByPlaceholderText('Re-enter your password'), 'password2');
    await user.type(screen.getByPlaceholderText('+1...'), '5551234567');
    await user.type(screen.getByPlaceholderText('STU...'), 'STU100');

    API.post.mockClear();
    await user.click(screen.getByRole('button', { name: /Verify & Create Account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Passwords do not match/i);
    expect(API.post).not.toHaveBeenCalled();
  });

  test('submits register-verify with trimmed fields on valid input', async () => {
    const user = userEvent.setup();
    renderRegister();
    await goToStep2(user);

    await user.type(screen.getByPlaceholderText('Enter 6-digit code'), '654321');
    await user.type(screen.getByPlaceholderText('John Doe'), '  New Student  ');
    await user.type(screen.getByPlaceholderText('Min 6 characters'), 'password1');
    await user.type(screen.getByPlaceholderText('Re-enter your password'), 'password1');
    await user.type(screen.getByPlaceholderText('+1...'), '555-123-4567');
    await user.type(screen.getByPlaceholderText('STU...'), 'STU100');

    API.post.mockResolvedValueOnce({ data: { user: { name: 'New Student', role: 'student' } } });
    await user.click(screen.getByRole('button', { name: /Verify & Create Account/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    expect(API.post).toHaveBeenCalledWith('/auth/register-verify', expect.objectContaining({
      name: 'New Student',
      otp: '654321',
      collegeId: 'STU100',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
