import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { AdminNav } from './AdminDashboard';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../utils/errorMessage';

export default function AdminItems() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    API.get('/admin/items')
      .then(({ data }) => { setItems(data); setLoading(false); })
      .catch((err) => { setError(getErrorMessage(err, 'Could not load items.')); setLoading(false); });
  }, []);

  const handleDelete = async id => {
    if (!window.confirm('Delete this item permanently?')) return;
    setDeleting(id);
    try {
      await API.delete(`/admin/items/${id}`);
      setItems(items.filter(i => i._id !== id));
      showToast('Item deleted.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete.'), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = items.filter(item =>
    (!search ||
      item.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.postedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || item.status === statusFilter) &&
    (!typeFilter || item.type === typeFilter)
  );

  if (loading) return <Spinner text="Loading items…" />;

  return (
    <div className="page-wrap">
      <div className="pg-header">
        <div className="pg-kicker">Admin</div>
        <h1 className="pg-title">Manage Items</h1>
        <p className="pg-sub">All posted items — {items.length} total</p>
      </div>

      <AdminNav />

      {error && <div className="alert-box alert-err" role="alert" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="search-box" style={{ maxWidth: 360, flex: '1 1 240px' }}>
          <span className="search-icon">🔍</span>
          <input
            className="inp"
            placeholder="Search by title, user, category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select className="inp inp-select" style={{ maxWidth: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="lost">Lost</option>
          <option value="found">Found</option>
        </select>
        <select className="inp inp-select" style={{ maxWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Claimed">Claimed</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {(statusFilter || typeFilter || search) && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: -12, marginBottom: 16 }}>
          Showing {filtered.length} of {items.length} items
        </p>
      )}

      <div className="tbl-wrap anim-in">
        <table className="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Category</th>
              <th>Posted By</th>
              <th>Status</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>No items found</td></tr>
            ) : filtered.map(item => (
              <tr key={item._id}>
                <td>
                  <Link to={`/items/${item._id}`} style={{ color: 'var(--neon)', fontWeight: 700, textDecoration: 'none', fontFamily: 'var(--font-display)', fontSize: '0.875rem' }}>
                    {item.title}
                  </Link>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 2 }}>📍 {item.location}</div>
                </td>
                <td><span className={`badge-pill ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>{item.type}</span></td>
                <td style={{ color: 'var(--text-3)', fontSize: '0.84rem' }}>{item.category}</td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{item.postedBy?.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{item.postedBy?.email}</div>
                </td>
                <td><span className={`badge-pill badge-${item.status}`}>{item.status}</span></td>
                <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-danger-soft btn-sm"
                    onClick={() => handleDelete(item._id)}
                    disabled={deleting === item._id}
                  >
                    {deleting === item._id ? '…' : '🗑️ Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
