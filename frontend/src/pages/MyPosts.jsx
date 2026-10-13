import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import Spinner from '../components/Spinner';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';

export default function MyPosts() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    API.get('/items/my-posts')
      .then(({ data }) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(getErrorMessage(err, 'Could not load your posts.')); setLoading(false); });
  }, []);

  const handleDelete = async id => {
    if (!window.confirm('Delete this post permanently?')) return;
    setDeleting(id);
    try {
      await API.delete(`/items/${id}`);
      setItems(items.filter(i => i._id !== id));
      showToast('Item deleted.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Delete failed.'), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    if (!window.confirm(`Mark this item as ${newStatus}?`)) return;
    try {
      await API.put(`/items/${id}`, { status: newStatus });
      setItems(items.map(i => i._id === id ? { ...i, status: newStatus } : i));
      showToast(`Item marked as ${newStatus}.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Update failed.'), 'error');
    }
  };

  if (loading) return <Spinner text="Loading your posts…" />;

  return (
    <div className="page-wrap">
      <div className="pg-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="pg-kicker">My Activity</div>
          <h1 className="pg-title">My Posts</h1>
          <p className="pg-sub">Items you've reported — {items.length} total</p>
        </div>
        <Link to="/post-item" className="btn btn-neon">+ New Report</Link>
      </div>

      {error && <div className="alert-box alert-err" role="alert" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {items.length > 0 && (
        <div className="anim-in" style={{ marginBottom: '24px', padding: '16px', background: 'var(--ink-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ fontSize: '1.5rem' }}>💡</div>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
            <strong>How to manage your posts:</strong><br />
            1. Use <strong>Mark as Matched</strong> when you find the owner/item (moves to <span style={{ color: 'var(--violet)', fontWeight: 700 }}>Claimed</span>).<br />
            2. Use <strong>Mark as Returned</strong> once the physical handover is complete (moves to <span style={{ color: 'var(--success)', fontWeight: 700 }}>Closed</span>).
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No posts yet</div>
          <p className="empty-state-sub">You haven't posted any items yet. Get started below.</p>
          <Link to="/post-item" className="btn btn-neon">Post Your First Item</Link>
        </div>
      ) : (
        <div className="tbl-wrap anim-in">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item._id}>
                  <td>
                    <Link to={`/items/${item._id}`} style={{ color: 'var(--neon)', fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-display)', fontSize: '0.875rem' }}>
                      {item.title}
                    </Link>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', marginTop: 2 }}>{item.location}</div>
                  </td>
                  <td>
                    <span className={`badge-pill ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-pill badge-${item.status.toLowerCase()}`}>{item.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {item.status === 'Open' && (
                        <button
                          className="btn btn-success-soft btn-sm"
                          onClick={() => handleStatusUpdate(item._id, 'Claimed')}
                        >
                          🤝 Mark as Matched
                        </button>
                      )}
                      {item.status === 'Claimed' && (
                        <button
                          className="btn btn-violet-soft btn-sm"
                          onClick={() => handleStatusUpdate(item._id, 'Closed')}
                        >
                          ✅ Mark as Returned
                        </button>
                      )}
                      <button
                        className="btn btn-danger-soft btn-sm"
                        onClick={() => handleDelete(item._id)}
                        disabled={deleting === item._id}
                      >
                        {deleting === item._id ? '…' : '🗑️'}
                      </button>
                    </div>
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
