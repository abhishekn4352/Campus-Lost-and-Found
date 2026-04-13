import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import API from '../api/axios';

export default function Navbar() {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoggedIn()) return;
    const fetchUnread = async () => {
      try {
        const { data } = await API.get('/messages/conversations');
        const count = data.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
        setUnreadCount(count);
      } catch (err) { console.error(err); }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [isLoggedIn()]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navLinks = [
    ...(isLoggedIn() ? [
      { to: '/dashboard', label: 'Dashboard' },
    ] : []),
    { to: '/items', label: 'Browse' },
    ...(isLoggedIn() ? [
      { to: '/post-item', label: 'Report Item' },
      { to: '/messages', label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
      { to: '/my-posts', label: 'My Posts' },
    ] : []),
    ...(isAdmin() ? [{ to: '/admin', label: 'Admin', admin: true }] : []),
  ];

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <nav className="navbar navbar-expand-lg navbar-premium py-0">
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '64px' }}>
          {/* Brand */}
          <Link to={isLoggedIn() ? "/dashboard" : "/"} className="brand-logo">
            <div className="brand-mark">🎒</div>
            <span>CAMPUS <span className="brand-text-accent">L&F</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="d-none d-lg-flex align-items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${link.admin ? 'admin-link' : ''}`}
                style={location.pathname === link.to || location.pathname.startsWith(link.to + '/') ? {
                  color: link.admin ? 'var(--amber) !important' : 'var(--neon)',
                  background: link.admin ? 'rgba(245,158,11,0.1)' : 'var(--neon-dim)',
                } : {}}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="d-none d-lg-flex align-items-center gap-2">
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-sm"
              style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center', fontSize: '1.2rem', borderRadius: '50%' }}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {isLoggedIn() ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 12px 5px 6px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '30px' }}>
                  <div className="nav-avatar">{initials}</div>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 1, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.name}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {user?.role === 'admin' ? 'Admin' : 'Member'}
                    </div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
                <Link to="/register" className="btn btn-neon btn-sm">Join Free</Link>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="d-lg-none btn btn-ghost btn-sm"
            data-bs-toggle="collapse"
            data-bs-target="#mobileNav"
            style={{ padding: '6px 10px' }}
          >
            ☰
          </button>
        </div>

        {/* Mobile Nav */}
        <div className="collapse d-lg-none" id="mobileNav">
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} className={`nav-link ${link.admin ? 'admin-link' : ''}`} style={{ width: 'fit-content' }}>
                {link.label}
              </Link>
            ))}
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              {isLoggedIn() ? (
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
              ) : (
                <>
                  <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
                  <Link to="/register" className="btn btn-neon btn-sm">Join Free</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
