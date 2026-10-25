import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';
import useCooldown from '../hooks/useCooldown';
import useDocumentTitle from '../hooks/useDocumentTitle';
import PasswordInput from '../components/PasswordInput';
import OtpInput from '../components/OtpInput';
import Button from '../components/Button';
import { Alert } from '../components/States';
import API from '../api/axios';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export default function Login() {
  useDocumentTitle('Log in');
  const [mode, setMode] = useState('password'); // 'password' | 'otp' | 'reset'
  const [codeSent, setCodeSent] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', otp: '', newPassword: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, startCooldown] = useCooldown(30);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const field = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const switchMode = (next) => { setMode(next); setCodeSent(false); setError(''); setInfo(''); setForm((f) => ({ ...f, otp: '', newPassword: '' })); };

  const finishLogin = ({ user, token }) => {
    login(user, token);
    showToast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
    const from = location.state?.from;
    navigate(from || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
  };

  const sendCode = async () => {
    const email = form.email.trim();
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.');
    setLoading(true); setError(''); setInfo('');
    try {
      await API.post('/auth/request-otp', { email, purpose: mode === 'reset' ? 'reset' : 'login' });
      setCodeSent(true);
      setForm((f) => ({ ...f, email, otp: '' }));
      setInfo('If an account exists for that email, we’ve sent a 6-digit code. It expires in 10 minutes.');
      startCooldown();
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t send a code right now.'));
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return setError('Enter your email address.');
    if (!form.password) return setError('Enter your password.');
    setLoading(true); setError('');
    try {
      const { data } = await API.post('/auth/login', { email: form.email.trim(), password: form.password });
      finishLogin(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed. Check your email and password.'));
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    if (form.otp.length !== 6) return setError('Enter the full 6-digit code.');
    setLoading(true); setError('');
    try {
      const { data } = await API.post('/auth/login-otp', { email: form.email.trim(), otp: form.otp });
      finishLogin(data);
    } catch (err) {
      setError(getErrorMessage(err, 'That code didn’t work.'));
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (form.otp.length !== 6) return setError('Enter the full 6-digit code.');
    if (form.newPassword.length < MIN_PASSWORD) return setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
    setLoading(true); setError('');
    try {
      await API.post('/auth/reset-password', { email: form.email.trim(), otp: form.otp, newPassword: form.newPassword });
      showToast('Password updated. Log in with your new password.', 'success');
      setForm((f) => ({ ...f, password: '', otp: '', newPassword: '' }));
      setMode('password'); setCodeSent(false); setInfo(''); setLoading(false);
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t reset your password.'));
      setLoading(false);
    }
  };

  const resend = (
    <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>
      {cooldown > 0 ? `You can request another code in ${cooldown}s.` : (
        <>Didn’t get it? <button type="button" className="link-btn" onClick={sendCode} disabled={loading}>Send a new code</button></>
      )}
    </p>
  );

  const emailField = (disabled) => (
    <div className="field">
      <label className="label" htmlFor="login-email">Email address</label>
      <div className="input-icon">
        <Mail size={18} aria-hidden="true" />
        <input id="login-email" type="email" className="input" value={form.email} onChange={field('email')} placeholder="you@college.edu" autoComplete="email" required disabled={disabled} />
      </div>
    </div>
  );

  return (
    <div className="auth">
      <div className="auth-card">
        <h1>{mode === 'reset' ? 'Reset your password' : 'Welcome back'}</h1>
        <p className="page-sub">{mode === 'reset' ? 'We’ll email you a code, then you can choose a new password.' : 'Log in to post items, claim yours and chat with finders.'}</p>

        {mode !== 'reset' && (
          <div className="seg" role="group" aria-label="Login method" style={{ marginBottom: 20 }}>
            <button type="button" aria-pressed={mode === 'password'} onClick={() => switchMode('password')}>Password</button>
            <button type="button" aria-pressed={mode === 'otp'} onClick={() => switchMode('otp')}>Email code</button>
          </div>
        )}

        {error && <Alert type="error">{error}</Alert>}
        {info && <Alert type="success">{info}</Alert>}

        {mode === 'password' && (
          <form onSubmit={submitPassword} noValidate>
            {emailField(false)}
            <PasswordInput label="Password" name="password" value={form.password} onChange={field('password')} placeholder="Enter your password" autoComplete="current-password" />
            <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 16 }}>
              <button type="button" className="link-btn" onClick={() => switchMode('reset')}>Forgot password?</button>
            </div>
            <Button type="submit" variant="primary" size="lg" block loading={loading}>Sign in</Button>
          </form>
        )}

        {mode === 'otp' && (
          <form onSubmit={submitOtp} noValidate>
            {emailField(codeSent)}
            {!codeSent ? (
              <Button variant="primary" size="lg" block loading={loading} disabled={!form.email} onClick={sendCode}>Send code</Button>
            ) : (
              <>
                <div className="field">
                  <span className="label" id="otp-label" style={{ textAlign: 'center' }}>Enter the 6-digit code</span>
                  <OtpInput value={form.otp} onChange={(otp) => setForm((f) => ({ ...f, otp }))} autoFocus />
                </div>
                <Button type="submit" variant="primary" size="lg" block loading={loading} disabled={form.otp.length !== 6}>Verify &amp; sign in</Button>
                {resend}
                <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
                  <button type="button" className="link-btn" onClick={() => { setCodeSent(false); setInfo(''); }}>Use a different email</button>
                </p>
              </>
            )}
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={submitReset} noValidate>
            {emailField(codeSent)}
            {!codeSent ? (
              <>
                <Button variant="primary" size="lg" block loading={loading} disabled={!form.email} onClick={sendCode}>Email me a code</Button>
                <p className="auth-foot"><button type="button" className="link-btn" onClick={() => switchMode('password')}>Back to log in</button></p>
              </>
            ) : (
              <>
                <div className="field">
                  <span className="label" style={{ textAlign: 'center' }}>Enter the 6-digit code</span>
                  <OtpInput value={form.otp} onChange={(otp) => setForm((f) => ({ ...f, otp }))} autoFocus />
                </div>
                <PasswordInput label="New password" name="newPassword" value={form.newPassword} onChange={field('newPassword')} autoComplete="new-password" showStrength hint={`At least ${MIN_PASSWORD} characters.`} />
                <Button type="submit" variant="primary" size="lg" block loading={loading}>Set new password</Button>
                {resend}
              </>
            )}
          </form>
        )}

        <p className="auth-foot">New here? <Link to="/register">Create an account</Link></p>
      </div>
    </div>
  );
}
