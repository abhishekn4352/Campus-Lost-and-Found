import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';

vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }));
import API from '../api/axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));

const mockLogin = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));
const mockShowToast = vi.fn();
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

const renderLogin = (entry = '/login') => render(<MemoryRouter initialEntries={[entry]}><Login /></MemoryRouter>);
const fillPasswordForm = async (user, email = 'riya@college.edu', password = 'password123') => {
  await user.type(screen.getByLabelText('Email address'), email);
  await user.type(screen.getByLabelText('Password'), password);
};

describe('Login page', () => {
  beforeEach(() => vi.clearAllMocks());

  test('renders the password form by default', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('successful login stores the user and goes to the dashboard', async () => {
    API.post.mockResolvedValue({ data: { user: { name: 'Riya Sharma', role: 'student' } } });
    const user = userEvent.setup();
    renderLogin();
    await fillPasswordForm(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ name: 'Riya Sharma', role: 'student' }));
    expect(API.post).toHaveBeenCalledWith('/auth/login', { email: 'riya@college.edu', password: 'password123' });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('sends the user back to the page they were trying to open', async () => {
    API.post.mockResolvedValue({ data: { user: { name: 'Riya', role: 'student' } } });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/items/42' } }]}><Login /></MemoryRouter>);
    await fillPasswordForm(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/items/42', { replace: true }));
  });

  test('admins land on the admin overview', async () => {
    API.post.mockResolvedValue({ data: { user: { name: 'Admin', role: 'admin' } } });
    const user = userEvent.setup();
    renderLogin();
    await fillPasswordForm(user, 'admin@college.edu', 'adminpass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true }));
  });

  test('shows the server error and does not navigate when login fails', async () => {
    API.post.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });
    const user = userEvent.setup();
    renderLogin();
    await fillPasswordForm(user, 'riya@college.edu', 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('blocks an empty submit without calling the API', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/email/i);
    expect(API.post).not.toHaveBeenCalled();
  });

  test('email-code login: request a code, enter it, sign in', async () => {
    API.post.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { user: { name: 'Riya', role: 'student' } } });
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Email code' }));
    await user.type(screen.getByLabelText('Email address'), 'riya@college.edu');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/request-otp', { email: 'riya@college.edu', purpose: 'login' }));
    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.paste('123456');
    await user.click(screen.getByRole('button', { name: /Verify/ }));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/login-otp', { email: 'riya@college.edu', otp: '123456' }));
    expect(mockLogin).toHaveBeenCalled();
  });

  test('forgot password: code + new password calls reset-password and returns to the login form', async () => {
    API.post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email address'), 'riya@college.edu');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/request-otp', { email: 'riya@college.edu', purpose: 'reset' }));

    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.paste('654321');
    await user.type(screen.getByLabelText('New password'), 'brand-new-pass');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/reset-password', { email: 'riya@college.edu', otp: '654321', newPassword: 'brand-new-pass' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/password updated/i), 'success');
  });

  test('rejects a too-short new password before calling the API', async () => {
    API.post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByLabelText('Email address'), 'riya@college.edu');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    await user.click(await screen.findByLabelText('Digit 1 of 6'));
    await user.paste('654321');
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/);
    expect(API.post).not.toHaveBeenCalledWith('/auth/reset-password', expect.anything());
  });
});
