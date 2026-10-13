import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';

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

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the password login form by default', () => {
    renderLogin();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@college.edu')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  });

  test('successful password login calls login() and navigates', async () => {
    API.post.mockResolvedValue({ data: { user: { name: 'Riya', role: 'student' } } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText('you@college.edu'), 'riya@college.edu');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ name: 'Riya', role: 'student' }));
    expect(mockNavigate).toHaveBeenCalledWith('/items');
  });

  test('failed password login shows an error message and does not navigate', async () => {
    API.post.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText('you@college.edu'), 'riya@college.edu');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('switching to OTP mode sends an OTP request and reveals the OTP field', async () => {
    API.post.mockResolvedValue({});
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'OTP Login' }));
    await user.type(screen.getByPlaceholderText('you@college.edu'), 'riya@college.edu');
    await user.click(screen.getByRole('button', { name: /Send OTP Code/i }));

    expect(API.post).toHaveBeenCalledWith('/auth/request-otp', { email: 'riya@college.edu' });
    await waitFor(() => expect(screen.getByText(/Enter 6-digit OTP/i)).toBeInTheDocument());
  });

  test('admin login redirects to /admin', async () => {
    API.post.mockResolvedValue({ data: { user: { name: 'Admin', role: 'admin' } } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText('you@college.edu'), 'admin@college.edu');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'adminpass');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });
});
