import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';
import PasswordInput from '../components/PasswordInput';
import API from '../api/axios';

const RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

export default function Register() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & Details
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', collegeId: '', otp: '' });
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
    if (!email) { setError('Email is required'); return false; }
    if (!EMAIL_RE.test(email)) { setError('Please enter a valid email address.'); return false; }
    setLoading(true);
    setError('');
    try {
      await API.post('/auth/request-otp', { email, purpose: 'register' });
      setForm(f => ({ ...f, email, otp: '' })); // clear any stale OTP from a previous send
      setSuccess('OTP verification code sent to your email.');
      startCooldown();
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send verification code.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (await requestOtp()) setStep(2);
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setSuccess('');
    await requestOtp();
  };

  const validateStep2 = () => {
    if (form.otp.length !== 6) return 'Please enter the full 6-digit code.';
    if (!form.name.trim()) return 'Full name is required.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!PHONE_RE.test(form.phone.trim())) return 'Please enter a valid phone number.';
    if (!form.collegeId.trim()) return 'College ID is required.';
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const validationError = validateStep2();
    if (validationError) return setError(validationError);

    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/auth/register-verify', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        collegeId: form.collegeId.trim(),
        otp: form.otp,
      });
      login(data.user);
      showToast(`Welcome to Campus L&F, ${data.user.name.split(' ')[0]}!`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Verification or registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card anim-up" style={{ maxWidth: 460 }}>
        <div className="auth-icon-wrap">🎓</div>
        <h2 className="auth-h">{step === 1 ? 'Join the community' : 'Complete profile'}</h2>
        <p className="auth-h-sub" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.9rem', marginBottom: '24px' }}>
          {step === 1 ? 'Verify your campus email to start' : 'Almost there! Set your account details'}
        </p>

        {error && <div className="alert-box alert-err" role="alert"><span>⚠️</span> {error}</div>}
        {success && <div className="alert-box alert-ok" role="status"><span>✅</span> {success}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestOTP} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="reg-email">Campus Email Address</label>
              <input 
                id="reg-email"
                type="email" 
                className="inp" 
                name="email" 
                value={form.email} 
                onChange={handleChange} 
                placeholder="you@college.edu" 
                autoComplete="email"
                required 
              />
            </div>
            <button type="submit" className="btn btn-neon btn-full btn-lg" style={{ marginTop: '8px' }} disabled={loading} aria-busy={loading}>
              {loading ? 'Sending...' : 'Send Verification Code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="reg-otp">Verification Code (OTP)</label>
              <input 
                id="reg-otp"
                type="text" 
                className="inp" 
                name="otp" 
                value={form.otp} 
                onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                maxLength={6} 
                placeholder="Enter 6-digit code" 
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                style={{ textAlign: 'center', letterSpacing: '0.4em', fontWeight: 700 }}
                required 
              />
              <div className="otp-resend-row" style={{ textAlign: 'left', marginTop: 8 }}>
                {cooldown > 0
                  ? <>Didn't get it? Resend in {cooldown}s</>
                  : <>Didn't get it?{' '}
                      <button type="button" className="otp-resend-btn" onClick={handleResendOTP} disabled={loading}>Resend code</button>
                    </>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 16px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>Your Details</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="reg-name">Full Name</label>
              <input id="reg-name" type="text" className="inp" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" autoComplete="name" required />
            </div>

            <PasswordInput
              label="Set Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min 6 characters"
              autoComplete="new-password"
            />

            <PasswordInput
              label="Confirm Password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
            {form.confirmPassword && (
              <p style={{ marginTop: -10, marginBottom: 14, fontSize: '0.78rem', color: form.password === form.confirmPassword ? '#6ee7b7' : '#fca5a5' }}>
                {form.password === form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}

            <div className="row g-2">
              <div className="col-md-6">
                <div className="field">
                  <label className="field-label" htmlFor="reg-phone">Phone Number</label>
                  <input id="reg-phone" type="tel" className="inp" name="phone" value={form.phone} onChange={handleChange} placeholder="+1..." autoComplete="tel" required />
                </div>
              </div>
              <div className="col-md-6">
                <div className="field">
                  <label className="field-label" htmlFor="reg-collegeid">College ID</label>
                  <input id="reg-collegeid" type="text" className="inp" name="collegeId" value={form.collegeId} onChange={handleChange} placeholder="STU..." required />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-neon btn-full btn-lg" style={{ marginTop: '14px' }} disabled={loading} aria-busy={loading}>
              {loading ? 'Finishing...' : 'Verify & Create Account'}
            </button>
            <button type="button" className="btn btn-ghost btn-full btn-sm" style={{ marginTop: '10px' }} onClick={() => { setStep(1); setError(''); setSuccess(''); }} disabled={loading}>
              Go Back
            </button>
          </form>
        )}

        <p className="auth-foot" style={{ marginTop: '24px' }}>
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
