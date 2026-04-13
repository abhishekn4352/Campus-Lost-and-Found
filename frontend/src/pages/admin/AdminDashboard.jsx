import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import API from '../../api/axios';
import Spinner from '../../components/Spinner';

const TABS = [
  { to: '/admin',        label: 'Dashboard', icon: '⚡' },
  { to: '/admin/items',  label: 'Items',     icon: '📦' },
  { to: '/admin/claims', label: 'Claims',    icon: '🙋' },
  { to: '/admin/users',  label: 'Users',     icon: '👥' },
];

export function AdminNav() {
  const location = useLocation();
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 28, flexWrap: 'wrap' }}>
      {TABS.map(tab => (
        <Link
          key={tab.to}
          to={tab.to}
          style={{ flex: 1, minWidth: 100, padding: '9px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-display)', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'var(--t)',
            background: location.pathname === tab.to ? 'var(--neon-dim)' : 'transparent',
            color: location.pathname === tab.to ? 'var(--neon)' : 'var(--text-3)',
            border: location.pathname === tab.to ? '1px solid rgba(0,229,255,0.2)' : '1px solid transparent',
          }}
        >
          {tab.icon} {tab.label}
        </Link>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    API.get('/admin/dashboard').then(({ data }) => setStats(data));
  }, []);

  if (!stats) return <Spinner text="Loading dashboard…" />;

  const cards = [
    { label: 'Active Lost',    value: stats.lost,          color: 'c-rose',    icon: '🔴' },
    { label: 'Active Found',   value: stats.found,         color: 'c-emerald', icon: '🟢' },
    { label: 'Claimed',        value: stats.claimed,       color: 'c-neon',    icon: '✅' },
    { label: 'Expired',        value: stats.expired,       color: 'c-violet',  icon: '⏰' },
    { label: 'Students',       value: stats.users,         color: 'c-amber',   icon: '👥' },
    { label: 'Pending Claims', value: stats.pendingClaims, color: 'c-rose',    icon: '⏳' },
  ];

  return (
    <div className="page-wrap">
      <div className="pg-header">
        <div className="pg-kicker">Admin</div>
        <h1 className="pg-title">Dashboard</h1>
        <p className="pg-sub">Overview of the Campus L&F system</p>
      </div>

      <AdminNav />

      <div className="row g-3 mb-5">
        {cards.map((card, i) => (
          <div key={card.label} className="col-6 col-md-4 col-lg-2">
            <div className={`admin-stat anim-up delay-${Math.min(i + 1, 5)}`}>
              <div className="admin-stat-icon">{card.icon}</div>
              <div className={`admin-stat-num ${card.color}`}>{card.value}</div>
              <div className="admin-stat-lbl">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ marginBottom: 12 }}>
        <div className="pg-kicker" style={{ marginBottom: 12 }}>Quick Actions</div>
        <div className="row g-3">
          {[
            { to: '/admin/items',  label: 'Manage Items',  icon: '📦', desc: 'Review, approve & remove item posts' },
            { to: '/admin/claims', label: 'Manage Claims', icon: '🙋', desc: 'Handle pending and approved claims' },
            { to: '/admin/users',  label: 'View Students', icon: '👥', desc: 'See all registered campus members' },
          ].map(link => (
            <div key={link.to} className="col-md-4">
              <Link to={link.to} className="admin-link-card">
                <span style={{ fontSize: '1.5rem' }}>{link.icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{link.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{link.desc}</div>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: '0.8rem' }}>→</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
