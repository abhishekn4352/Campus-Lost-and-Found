import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalPosts: 0, activeClaims: 0, resolved: 0 });
  const [recentItems, setRecentItems] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [postsRes, itemsRes, convsRes] = await Promise.all([
          API.get('/items/my-posts'),
          API.get('/items?limit=5'),
          API.get('/messages/conversations')
        ]);
        
        // Calculate stats
        const myPosts = postsRes.data;
        setStats({
          totalPosts: myPosts.length,
          activeClaims: myPosts.filter(i => i.status === 'Open').length,
          resolved: myPosts.filter(i => i.status === 'Closed' || i.status === 'Claimed').length
        });

        setRecentItems(itemsRes.data.slice(0, 5));
        
        // Calculate unread
        const unread = convsRes.data.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setTotalUnread(unread);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Spinner text="Loading your dashboard..." />;

  return (
    <div className="page-wrap">
      <div className="pg-header">
        <div className="pg-kicker">Welcome back, {user?.name}</div>
        <h1 className="pg-title">Dashboard</h1>
        <p className="pg-sub">Manage your items and track your activity</p>
      </div>

      {totalUnread > 0 && (
        <div className="anim-in" style={{ marginBottom: '32px' }}>
          <Link to="/messages" className="alert-box alert-warn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
            <span>📧 You have <strong>{totalUnread}</strong> unread message{totalUnread > 1 ? 's' : ''}. Check your conversations to coordinate returns.</span>
            <span style={{ fontSize: '1.2rem' }}>→</span>
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="row g-3 mb-5">
        {[
          { label: 'My Posts', value: stats.totalPosts, icon: '📋', color: 'var(--neon)' },
          { label: 'Active Reports', value: stats.activeClaims, icon: '🔍', color: 'var(--violet)' },
          { label: 'Resolved Cases', value: stats.resolved, icon: '✅', color: 'var(--success)' },
        ].map((s, i) => (
          <div className="col-md-4" key={i}>
            <div className="stat-card anim-up" style={{ padding: '24px', background: 'var(--ink-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '4rem', opacity: 0.05 }}>{s.icon}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: s.color, marginTop: '4px' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        {/* Recent Items Feed */}
        <div className="col-lg-8">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Recently Reported</h2>
            <Link to="/items" className="auth-link" style={{ fontSize: '0.85rem' }}>View all →</Link>
          </div>
          <div className="recent-list">
            {recentItems.length === 0 ? (
              <p style={{ color: 'var(--text-3)' }}>No recent items reported.</p>
            ) : (
              recentItems.map((item, i) => (
                <Link to={`/items/${item._id}`} key={item._id} className="recent-item-row anim-in" style={{ animationDelay: `${i * 0.1}s`, display: 'flex', gap: '16px', padding: '16px', background: 'var(--ink-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '12px', textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: 'var(--ink-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                    {item.imageUrl ? <img src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{item.location} • {new Date(item.lostFoundDate).toLocaleDateString()}</div>
                    <span className={`badge-pill ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`} style={{ marginTop: '6px', display: 'inline-block', fontSize: '0.65rem' }}>{item.type}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-lg-4">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Quick Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link to="/post-item" className="btn btn-neon btn-lg btn-full" style={{ textAlign: 'center' }}>+ Report Lost/Found Item</Link>
            <Link to="/my-posts" className="btn btn-ghost btn-lg btn-full" style={{ textAlign: 'center' }}>Manage My Posts</Link>
            <Link to="/my-claims" className="btn btn-ghost btn-lg btn-full" style={{ textAlign: 'center' }}>Track My Claims</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
