import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import Spinner from '../components/Spinner';

export default function MyClaims() {
  const [claims, setClaims]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/claims/my-claims')
      .then(({ data }) => { setClaims(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner text="Loading your claims…" />;

  const pendingCount  = claims.filter(c => c.status === 'pending').length;
  const approvedCount = claims.filter(c => c.status === 'approved').length;

  return (
    <div className="page-wrap">
      <div className="pg-header">
        <div className="pg-kicker">My Activity</div>
        <h1 className="pg-title">My Claims</h1>
        <p className="pg-sub">Track the items you've claimed — {claims.length} total</p>
      </div>

      {/* Summary chips */}
      {claims.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <span className="badge-pill badge-pending">⏳ {pendingCount} pending</span>
          <span className="badge-pill badge-active">✅ {approvedCount} approved</span>
        </div>
      )}

      {claims.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🙋</div>
          <div className="empty-state-title">No claims yet</div>
          <p className="empty-state-sub">Browse found items and claim yours if you spot something that belongs to you.</p>
          <Link to="/items" className="btn btn-neon">Browse Items</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {claims.map((claim, i) => {
            const item      = claim.itemId;
            const imgSrc    = item?.imageUrl
              ? `${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`
              : null;

            return (
              <div key={claim._id} className={`claim-row anim-up delay-${Math.min(i + 1, 5)}`}>
                {/* Thumbnail */}
                <div className="claim-thumb">
                  {imgSrc
                    ? <img src={imgSrc} alt={item?.title} />
                    : <span>📦</span>
                  }
                </div>

                {/* Info */}
                <div className="claim-info">
                  <div className="claim-name">{item?.title || 'Unknown Item'}</div>
                  <div className="claim-date">
                    Claimed {new Date(claim.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {item?.location && ` · ${item.location}`}
                  </div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {item?.type && (
                    <span className={`badge-pill ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
                      {item.type}
                    </span>
                  )}
                  <span className={`badge-pill badge-${claim.status}`}>{claim.status}</span>
                  {claim.otpVerified && (
                    <span className="badge-pill badge-verified">✓ Verified</span>
                  )}
                </div>

                {/* OTP action */}
                {!claim.otpVerified && claim.status === 'pending' && (
                  <Link
                    to={`/verify-otp/${claim._id}`}
                    className="btn btn-neon btn-sm"
                    style={{ flexShrink: 0 }}
                  >
                    Verify OTP
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
