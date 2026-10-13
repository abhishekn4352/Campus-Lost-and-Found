import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function OtpVerify() {
  const { claimId } = useParams();
  const navigate    = useNavigate();
  const [otp, setOtp]       = useState('');
  const [msg, setMsg]       = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  // Which item this claim is actually for — previously this page gave no
  // confirmation of that at all, which is disorienting if someone has
  // more than one thing in progress. Reuses the existing /claims/my-claims
  // list (already returns populated item info) instead of adding a new
  // single-claim backend endpoint just for this.
  const [claimItem, setClaimItem] = useState(null);

  useEffect(() => {
    API.get('/claims/my-claims')
      .then(({ data }) => {
        const match = data.find(c => c._id === claimId);
        if (match?.itemId) setClaimItem(match.itemId);
      })
      .catch(() => {}); // non-critical — the OTP form still works without this context
  }, [claimId]);

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
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', marginBottom: claimItem ? 16 : 28, fontWeight: 300, lineHeight: 1.6 }}>
          Check your college email for the 6-digit code and enter it below to confirm your claim.
        </p>

        {claimItem && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel-2, var(--panel))', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 20, textAlign: 'left' }}>
            <span style={{ fontSize: '1.3rem' }}>{claimItem.type === 'lost' ? '❓' : '📦'}</span>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Claiming</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{claimItem.title}</div>
            </div>
          </div>
        )}

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
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
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
          {success
            ? 'The item has been marked as Claimed and the owner has been notified. You can track it anytime from My Claims.'
            : "OTP expires in 10 minutes. Didn't receive it? Check your spam folder."}
        </p>
      </div>
    </div>
  );
}
