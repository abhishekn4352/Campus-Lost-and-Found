import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { AdminNav } from './AdminDashboard';

export default function AdminItems() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    API.get('/admin/items')
      .then(({ data }) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async id => {
    if (!window.confirm('Delete this item permanently?')) return;
    setDeleting(id);
    try {
      await API.delete(`/admin/items/${id}`);
      setItems(items.filter(i => i._id !== id));
    } catch {
      alert('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = items.filter(item =>
    !search ||
    item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.postedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.toLowerCase().includes(search.toLowerCase())
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

      {/* Search */}
      <div className="search-box" style={{ marginBottom: 20, maxWidth: 360 }}>
        <span className="search-icon">🔍</span>
        <input
          className="inp"
          placeholder="Search by title, user, category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      <div className="tbl-wrap anim-in" style={{ overflowX: 'auto' }}>
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
