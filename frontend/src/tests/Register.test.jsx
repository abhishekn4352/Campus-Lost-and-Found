import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from '../pages/Register';

vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }));
import API from '../api/axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => mockNavigate }));
const mockLogin = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const renderRegister = () => render(<MemoryRouter><Register /></MemoryRouter>);

async function reachDetailsStep(user) {
  API.post.mockResolvedValueOnce({ data: {} });
  await user.type(screen.getByLabelText('Email address'), '  riya@college.edu ');
  await user.click(screen.getByRole('button', { name: 'Send verification code' }));
  await user.click(await screen.findByLabelText('Digit 1 of 6'));
  await user.paste('123456');
}

async function fillDetails(user, overrides = {}) {
  const v = { name: '  Riya Sharma ', password: 'password123', confirm: 'password123', phone: ' 98765 43210 ', collegeId: ' STU2041 ', ...overrides };
  await user.type(screen.getByLabelText('Full name'), v.name);
  await user.type(screen.getByLabelText('Password'), v.password);
  await user.type(screen.getByLabelText('Confirm password'), v.confirm);
  await user.type(screen.getByLabelText('Phone number'), v.phone);
  await user.type(screen.getByLabelText('College ID'), v.collegeId);
}

describe('Register page', () => {
  beforeEach(() => vi.clearAllMocks());

  test('step 1 rejects an invalid email without calling the API', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);
    expect(API.post).not.toHaveBeenCalled();
  });

  test('step 1 requests a registration code for the trimmed email', async () => {
    const user = userEvent.setup();
    renderRegister();
    await reachDetailsStep(user);
    expect(API.post).toHaveBeenCalledWith('/auth/request-otp', { email: 'riya@college.edu', purpose: 'register' });
    expect(screen.getByRole('heading', { name: 'Finish setting up' })).toBeInTheDocument();
  });

  test('shows the server message when the email is already registered', async () => {
    API.post.mockRejectedValue({ response: { data: { message: 'An account with this email already exists. Please log in instead.' } } });
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Email address'), 'riya@college.edu');
    await user.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
  });

  test('blocks submission when the passwords do not match', async () => {
    const user = userEvent.setup();
    renderRegister();
    await reachDetailsStep(user);
    await fillDetails(user, { confirm: 'different-pass' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect((await screen.findAllByText(/do not match/i)).length).toBeGreaterThan(0);
    expect(API.post).toHaveBeenCalledTimes(1); // only the OTP request
  });

  test('blocks submission when the password is shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderRegister();
    await reachDetailsStep(user);
    await fillDetails(user, { password: 'short1', confirm: 'short1' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/);
  });

  test('submits trimmed details, logs the user in and opens the dashboard', async () => {
    const user = userEvent.setup();
    renderRegister();
    await reachDetailsStep(user);
    await fillDetails(user);
    API.post.mockResolvedValueOnce({ data: { user: { name: 'Riya Sharma', role: 'student' } } });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/auth/register-verify', {
      name: 'Riya Sharma', email: 'riya@college.edu', password: 'password123', phone: '98765 43210', collegeId: 'STU2041', otp: '123456',
    }));
    expect(mockLogin).toHaveBeenCalledWith({ name: 'Riya Sharma', role: 'student' });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
