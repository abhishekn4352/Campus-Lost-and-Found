import { useState, useEffect } from 'react';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';
import { AdminNav } from './AdminDashboard';

export default function AdminUsers() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    API.get('/admin/users')
      .then(({ data }) => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.collegeId?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner text="Loading students…" />;

  return (
    <div className="page-wrap">
      <div className="pg-header">
        <div className="pg-kicker">Admin</div>
        <h1 className="pg-title">Students</h1>
        <p className="pg-sub">All registered campus members — {users.length} total</p>
      </div>

      <AdminNav />

      {/* Search */}
      <div className="search-box" style={{ marginBottom: 20, maxWidth: 360 }}>
        <span className="search-icon">🔍</span>
        <input
          className="inp"
          placeholder="Search by name, email, ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">No students yet</div>
          <p className="empty-state-sub">No students have registered yet.</p>
        </div>
      ) : (
        <div className="tbl-wrap anim-in" style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Email</th>
                <th>College ID</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>No results</td></tr>
              ) : filtered.map((user, i) => {
                const initials = user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                return (
                  <tr key={user._id}>
                    <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--neon), var(--violet))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: 'var(--ink)', flexShrink: 0, fontFamily: 'var(--font-display)' }}>
                          {initials}
                        </div>
                        <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '0.875rem', color: 'var(--text)' }}>
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.84rem' }}>{user.email}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--neon)', background: 'var(--neon-dim)', border: '1px solid rgba(0,229,255,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                        {user.collegeId}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                      {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
