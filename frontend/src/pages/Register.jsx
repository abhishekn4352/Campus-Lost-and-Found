import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

export default function Register() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & Details
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', collegeId: '', otp: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!form.email) return setError('Email is required');
    setLoading(true);
    setError('');
    try {
      await API.post('/auth/request-otp', { email: form.email });
      setStep(2);
      setSuccess('OTP verification code sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await API.post('/auth/register-verify', form);
      login(data.user);
      navigate('/dashboard'); // Change to dashboard
    } catch (err) {
      setError(err.response?.data?.message || 'Verification or Registration failed.');
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

        {error && <div className="alert-box alert-err"><span>⚠️</span> {error}</div>}
        {success && <div className="alert-box alert-ok"><span>✅</span> {success}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestOTP}>
            <div className="field">
              <label className="field-label">Campus Email Address</label>
              <input 
                type="email" 
                className="inp" 
                name="email" 
                value={form.email} 
                onChange={handleChange} 
                placeholder="you@college.edu" 
                required 
              />
            </div>
            <button type="submit" className="btn btn-neon btn-full btn-lg" style={{ marginTop: '8px' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Verification Code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="field">
              <label className="field-label">Verification Code (OTP)</label>
              <input 
                type="text" 
                className="inp" 
                name="otp" 
                value={form.otp} 
                onChange={handleChange} 
                maxLength={6} 
                placeholder="Enter 6-digit code" 
                style={{ textAlign: 'center', letterSpacing: '0.4em', fontWeight: 700 }}
                required 
              />
            </div>
            
            <div className="field">
              <label className="field-label">Full Name</label>
              <input type="text" className="inp" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" required />
            </div>

            <div className="field">
              <label className="field-label">Set Password</label>
              <input type="password" className="inp" name="password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" required />
            </div>

            <div className="row g-2">
              <div className="col-md-6">
                <div className="field">
                  <label className="field-label">Phone Number</label>
                  <input type="text" className="inp" name="phone" value={form.phone} onChange={handleChange} placeholder="+1..." required />
                </div>
              </div>
              <div className="col-md-6">
                <div className="field">
                  <label className="field-label">College ID</label>
                  <input type="text" className="inp" name="collegeId" value={form.collegeId} onChange={handleChange} placeholder="STU..." required />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-neon btn-full btn-lg" style={{ marginTop: '14px' }} disabled={loading}>
              {loading ? 'Finishing...' : 'Verify & Create Account'}
            </button>
            <button type="button" className="btn btn-ghost btn-full btn-sm" style={{ marginTop: '10px' }} onClick={() => setStep(1)} disabled={loading}>
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
