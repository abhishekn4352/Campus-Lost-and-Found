import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';
import PasswordInput from '../components/PasswordInput';
import API from '../api/axios';

const RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'otp'
  const [otpSent, setOtpSent] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const cooldownRef = useRef(null);

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const requestOtp = async () => {
    const email = form.email.trim();
    if (!email) return setError('Email is required');
    if (!EMAIL_RE.test(email)) return setError('Please enter a valid email address.');
    setLoading(true);
    setError('');
    try {
      await API.post('/auth/request-otp', { email });
      setOtpSent(true);
      setForm(f => ({ ...f, email, otp: '' })); // clear any stale OTP from a previous send
      setSuccess('OTP sent to your email.');
      startCooldown();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async () => { await requestOtp(); };
  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setSuccess('');
    await requestOtp();
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email) return setError('Email is required');
    if (!form.password) return setError('Password is required');
    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/auth/login', { email, password: form.password });
      login(data.user);
      showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');
      navigate(data.user.role === 'admin' ? '/admin' : '/items');
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOTPLogin = async (e) => {
    e.preventDefault();
    if (form.otp.length !== 6) return setError('Please enter the full 6-digit code.');
    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/auth/login-otp', { email: form.email.trim(), otp: form.otp });
      login(data.user);
      showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');
      navigate(data.user.role === 'admin' ? '/admin' : '/items');
    } catch (err) {
      setError(getErrorMessage(err, 'OTP verification failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card anim-up">
        <div className="auth-icon-wrap">🔐</div>
        <h2 className="auth-h">Welcome back</h2>
        <p className="auth-sub">Sign in to your campus account</p>

        <div className="type-toggle" style={{ marginBottom: '24px' }}>
          <button 
            type="button" 
            className={`btn btn-sm ${loginMode === 'password' ? 'btn-neon' : 'btn-ghost'}`}
            onClick={() => { setLoginMode('password'); setOtpSent(false); setSuccess(''); setError(''); }}
          >
            Password
          </button>
          <button 
            type="button" 
            className={`btn btn-sm ${loginMode === 'otp' ? 'btn-neon' : 'btn-ghost'}`}
            onClick={() => { setLoginMode('otp'); setSuccess(''); setError(''); }}
          >
            OTP Login
          </button>
        </div>

        {error && <div className="alert-box alert-err" role="alert"><span>⚠️</span> {error}</div>}
        {success && <div className="alert-box alert-ok" role="status"><span>✅</span> {success}</div>}

        {loginMode === 'password' ? (
          <form onSubmit={handlePasswordLogin} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="login-email">Email Address</label>
              <input id="login-email" type="email" className="inp" name="email" value={form.email} onChange={handleChange} placeholder="you@college.edu" autoComplete="email" required />
            </div>
            <PasswordInput
              label="Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button type="submit" className="btn btn-neon btn-full btn-lg" style={{ marginTop: '8px' }} disabled={loading} aria-busy={loading}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Sign In →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOTPLogin} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="login-otp-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input id="login-otp-email" type="email" className="inp" name="email" value={form.email} onChange={handleChange} placeholder="you@college.edu" autoComplete="email" required disabled={otpSent} />
                {otpSent && <button type="button" onClick={() => { setOtpSent(false); setForm(f => ({ ...f, otp: '' })); setSuccess(''); }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--neon)', fontSize: '0.7rem', fontWeight: 600 }}>Change</button>}
              </div>
            </div>
            
            {!otpSent ? (
              <button type="button" className="btn btn-ghost btn-full btn-lg" onClick={handleRequestOTP} disabled={loading || !form.email}>
                {loading ? 'Sending...' : 'Send OTP Code'}
              </button>
            ) : (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="login-otp-code">Enter 6-digit OTP</label>
                  <input
                    id="login-otp-code"
                    type="text"
                    className="inp"
                    name="otp"
                    value={form.otp}
                    onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    maxLength={6}
                    placeholder="· · · · · ·"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.2rem' }}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-neon btn-full btn-lg" disabled={loading || form.otp.length !== 6} aria-busy={loading}>
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
                <div className="otp-resend-row">
                  {cooldown > 0
                    ? <>Didn't receive the code? Resend in {cooldown}s</>
                    : <>Didn't receive the code?{' '}
                        <button type="button" className="otp-resend-btn" onClick={handleResendOTP} disabled={loading}>Resend OTP</button>
                      </>}
                </div>
              </>
            )}
          </form>
        )}

        <p className="auth-foot">
          No account?{' '}
          <Link to="/register" className="auth-link">Create one free</Link>
        </p>
      </div>
    </div>
  );
}
