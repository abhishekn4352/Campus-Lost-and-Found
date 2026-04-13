import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function Login() {
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'otp'
  const [otpSent, setOtpSent] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRequestOTP = async () => {
    if (!form.email) return setError('Email is required');
    setLoading(true);
    setError('');
    try {
      await API.post('/auth/request-otp', { email: form.email });
      setOtpSent(true);
      setSuccess('OTP sent to your email');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/auth/login', { email: form.email, password: form.password });
      login(data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/items');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/auth/login-otp', { email: form.email, otp: form.otp });
      login(data.user);
      navigate(data.user.role === 'admin' ? '/admin' : '/items');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP Verification failed.');
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
            onClick={() => { setLoginMode('password'); setOtpSent(false); setSuccess(''); }}
          >
            Password
          </button>
          <button 
            type="button" 
            className={`btn btn-sm ${loginMode === 'otp' ? 'btn-neon' : 'btn-ghost'}`}
            onClick={() => { setLoginMode('otp'); setSuccess(''); }}
          >
            OTP Login
          </button>
        </div>

        {error && <div className="alert-box alert-err"><span>⚠️</span> {error}</div>}
        {success && <div className="alert-box alert-ok"><span>✅</span> {success}</div>}

        {loginMode === 'password' ? (
          <form onSubmit={handlePasswordLogin}>
            <div className="field">
              <label className="field-label">Email Address</label>
              <input type="email" className="inp" name="email" value={form.email} onChange={handleChange} placeholder="you@college.edu" required />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input type="password" className="inp" name="password" value={form.password} onChange={handleChange} placeholder="Enter your password" required />
            </div>
            <button type="submit" className="btn btn-neon btn-full btn-lg" style={{ marginTop: '8px' }} disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Sign In →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOTPLogin}>
            <div className="field">
              <label className="field-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <input type="email" className="inp" name="email" value={form.email} onChange={handleChange} placeholder="you@college.edu" required disabled={otpSent} />
                {otpSent && <button type="button" onClick={() => setOtpSent(false)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--neon)', fontSize: '0.7rem', fontWeight: 600 }}>Change</button>}
              </div>
            </div>
            
            {!otpSent ? (
              <button type="button" className="btn btn-ghost btn-full btn-lg" onClick={handleRequestOTP} disabled={loading || !form.email}>
                {loading ? 'Sending...' : 'Send OTP Code'}
              </button>
            ) : (
              <>
                <div className="field">
                  <label className="field-label">Enter 6-digit OTP</label>
                  <input type="text" className="inp" name="otp" value={form.otp} onChange={handleChange} maxLength={6} placeholder="· · · · · ·" style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.2rem' }} required />
                </div>
                <button type="submit" className="btn btn-neon btn-full btn-lg" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
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
