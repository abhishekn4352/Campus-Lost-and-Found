import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function OtpVerify() {
  const { claimId } = useParams();
  const navigate    = useNavigate();
  const [otp, setOtp]       = useState('');
  const [msg, setMsg]       = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = async e => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const { data } = await API.post(`/claims/verify-otp/${claimId}`, { otp });
      setMsg(data.message);
      setSuccess(true);
      setTimeout(() => navigate('/my-claims'), 2500);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-page">
      <div className="otp-card anim-up">
        <div className="otp-icon">🔐</div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>
          Verify Your Claim
        </h2>
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', marginBottom: 28, fontWeight: 300, lineHeight: 1.6 }}>
          Check your college email for the 6-digit code and enter it below to confirm your claim.
        </p>

        {msg && (
          <div className={`alert-box ${success ? 'alert-ok' : 'alert-err'}`} style={{ marginBottom: 20, justifyContent: 'center' }}>
            {success ? '✅' : '⚠️'} {msg}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            type="text"
            className="otp-inp"
            placeholder="000000"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            required
            disabled={success}
            autoFocus
          />

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '14px 0' }}>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: i < otp.length ? 'var(--neon)' : 'var(--border)',
                  transition: 'background 0.2s ease',
                  boxShadow: i < otp.length ? '0 0 8px var(--neon-glow)' : 'none',
                }}
              />
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-success-soft btn-full btn-lg"
            style={{ marginTop: 8 }}
            disabled={loading || success || otp.length !== 6}
          >
            {loading
              ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Verifying…</>
              : success
                ? '✅ Verified! Redirecting…'
                : '🔓 Verify & Claim'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
          OTP expires in 10 minutes. Didn't receive it? Check your spam folder.
        </p>
      </div>
    </div>
  );
}
