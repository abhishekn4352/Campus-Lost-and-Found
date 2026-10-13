import { useState, useEffect } from 'react';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { AdminNav } from './AdminDashboard';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errorMessage';

export default function AdminClaims() {
  const [claims, setClaims]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing]   = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    API.get('/admin/claims')
      .then(({ data }) => { setClaims(data); setLoading(false); })
      .catch((err) => { setError(getErrorMessage(err, 'Could not load claims.')); setLoading(false); });
  }, []);

  const handleApprove = async id => {
    setActing(id + '-approve');
    try {
      await API.put(`/admin/claims/${id}/approve`);
      setClaims(claims.map(c => c._id === id ? { ...c, status: 'approved' } : c));
      showToast('Claim approved.', 'success');
    } catch (err) { showToast(getErrorMessage(err, 'Failed to approve.'), 'error'); }
    finally { setActing(null); }
  };

  const handleReject = async id => {
    if (!window.confirm('Reject this claim?')) return;
    setActing(id + '-reject');
    try {
      await API.put(`/admin/claims/${id}/reject`);
      setClaims(claims.map(c => c._id === id ? { ...c, status: 'rejected' } : c));
      showToast('Claim rejected.', 'success');
    } catch (err) { showToast(getErrorMessage(err, 'Failed to reject.'), 'error'); }
    finally { setActing(null); }
  };

  if (loading) return <Spinner text="Loading claims…" />;

  const pendingCount = claims.filter(c => c.status === 'pending').length;

  return (
    <div className="page-wrap">
      <div className="pg-header">
        <div className="pg-kicker">Admin</div>
        <h1 className="pg-title">
          Manage Claims
          {pendingCount > 0 && (
            <span className="result-count" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', borderColor: 'rgba(245,158,11,0.3)' }}>
              {pendingCount} pending
            </span>
          )}
        </h1>
        <p className="pg-sub">Review and process item claims — {claims.length} total</p>
      </div>

      <AdminNav />

      {error && <div className="alert-box alert-err" role="alert" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {claims.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🙋</div>
          <div className="empty-state-title">No claims yet</div>
          <p className="empty-state-sub">No claims have been submitted yet.</p>
        </div>
      ) : (
        <div className="tbl-wrap anim-in">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Owner</th>
                <th>Claimed By</th>
                <th>OTP</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(claim => (
                <tr key={claim._id}>
                  <td>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '0.875rem', color: 'var(--text)' }}>
                      {claim.itemId?.title || 'N/A'}
                    </div>
                    {claim.itemId?.type && (
                      <span className={`badge-pill ${claim.itemId.type === 'lost' ? 'badge-lost' : 'badge-found'}`} style={{ marginTop: 4, display: 'inline-flex' }}>
                        {claim.itemId.type}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{claim.itemId?.postedBy?.name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{claim.itemId?.postedBy?.email}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{claim.claimedBy?.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{claim.claimedBy?.email}</div>
                    {claim.itemId?.postedBy?._id && claim.claimedBy?._id === claim.itemId.postedBy._id && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--amber)', marginTop: 2 }}>⚠️ Same as owner</div>
                    )}
                  </td>
                  <td>
                    {claim.otpVerified
                      ? <span className="badge-pill badge-verified">✓ Verified</span>
                      : <span className="badge-pill badge-pending">⏳ Pending</span>
                    }
                  </td>
                  <td><span className={`badge-pill badge-${claim.status}`}>{claim.status}</span></td>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{new Date(claim.createdAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    {claim.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-success-soft btn-sm"
                          onClick={() => handleApprove(claim._id)}
                          disabled={acting === claim._id + '-approve'}
                        >
                          {acting === claim._id + '-approve' ? '…' : '✅ Approve'}
                        </button>
                        <button
                          className="btn btn-danger-soft btn-sm"
                          onClick={() => handleReject(claim._id)}
                          disabled={acting === claim._id + '-reject'}
                        >
                          {acting === claim._id + '-reject' ? '…' : '❌ Reject'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
