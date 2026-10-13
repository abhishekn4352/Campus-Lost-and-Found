import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import API from '../api/axios';

export default function Navbar() {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Close either open dropdown whenever the route changes, so navigating
  // away doesn't leave a stale menu open.
  useEffect(() => { setAccountMenuOpen(false); setNotifMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    const fetchActivity = async () => {
      try {
        const [convsRes, claimsRes] = await Promise.all([
          API.get('/messages/conversations'),
          API.get('/claims/my-claims'),
        ]);
        const unread = convsRes.data.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
        setUnreadCount(unread);
        setPendingClaimsCount(claimsRes.data.filter(c => c.status === 'pending').length);
      } catch (err) { console.error(err); }
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [isLoggedIn()]);

  const handleLogout = async () => {
    if (loggingOut) return; // prevent a rapid double-click from stacking duplicate toasts/requests
    setLoggingOut(true);
    try {
      await logout();
      showToast('You have been signed out.', 'info');
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const totalNotifications = unreadCount + pendingClaimsCount;

  const navLinks = [
    ...(isLoggedIn() ? [
      { to: '/dashboard', label: 'Dashboard' },
    ] : []),
    { to: '/items', label: 'Browse' },
    ...(isLoggedIn() ? [
      { to: '/post-item', label: 'Report Item' },
      { to: '/messages', label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
      { to: '/my-posts', label: 'My Posts' },
      { to: '/my-claims', label: `My Claims${pendingClaimsCount > 0 ? ` (${pendingClaimsCount})` : ''}` },
    ] : []),
    ...(isAdmin() ? [{ to: '/admin', label: 'Admin', admin: true }] : []),
  ];

  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <>
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

          {/* Right-hand cluster: Actions + hamburger toggle are grouped in
              one flex container so they stay visually tight together
              under the outer row's justify-content:space-between,
              regardless of which pieces are hidden/shown at a given
              breakpoint. Without this wrapper, hiding navLinks at tablet
              width would leave the Actions block floating in the middle
              of the bar (space-between distributes space between ALL
              visible direct children equally) instead of sitting next to
              the hamburger button on the right, as intended. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Actions — bell + account chip get their own, narrower
                breakpoint (768px) than the full nav link list (992px):
                a tablet-width screen has room for these compact controls
                even though it doesn't have room for the whole text link
                list, and without this they'd otherwise fall into a dead
                zone (too wide for the bottom-nav, which is phone-only
                below 768px; too narrow for the 992px desktop link list)
                with no persistent notification/account access at all
                except the hamburger menu. */}
            <div className="d-none d-md-flex align-items-center gap-2">
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
                {/* Notification bell — aggregates unread messages + pending
                    claims from data already being fetched, rather than a
                    new persisted notification model. */}
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center', fontSize: '1.1rem', borderRadius: '50%', position: 'relative' }}
                    onClick={() => { setNotifMenuOpen(o => !o); setAccountMenuOpen(false); }}
                    aria-label={`Notifications${totalNotifications > 0 ? `, ${totalNotifications} unread` : ''}`}
                    aria-haspopup="true"
                    aria-expanded={notifMenuOpen}
                  >
                    🔔
                    {totalNotifications > 0 && (
                      <span className="nav-badge" aria-hidden="true">{totalNotifications > 9 ? '9+' : totalNotifications}</span>
                    )}
                  </button>
                  {notifMenuOpen && (
                    <>
                      <div className="dropdown-overlay" onClick={() => setNotifMenuOpen(false)} />
                      <div className="dropdown-panel" role="menu">
                        {totalNotifications === 0 ? (
                          <div className="dropdown-empty">You're all caught up 🎉</div>
                        ) : (
                          <>
                            {unreadCount > 0 && (
                              <Link to="/messages" className="dropdown-item" role="menuitem" onClick={() => setNotifMenuOpen(false)}>
                                💬 {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                              </Link>
                            )}
                            {pendingClaimsCount > 0 && (
                              <Link to="/my-claims" className="dropdown-item" role="menuitem" onClick={() => setNotifMenuOpen(false)}>
                                🔓 {pendingClaimsCount} pending claim{pendingClaimsCount !== 1 ? 's' : ''}
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Account menu */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setAccountMenuOpen(o => !o); setNotifMenuOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 12px 5px 6px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '30px', cursor: 'pointer' }}
                    aria-haspopup="true"
                    aria-expanded={accountMenuOpen}
                  >
                    <div className="nav-avatar">{initials}</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 1, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.name}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {user?.role === 'admin' ? 'Admin' : 'Member'}
                      </div>
                    </div>
                  </button>
                  {accountMenuOpen && (
                    <>
                      <div className="dropdown-overlay" onClick={() => setAccountMenuOpen(false)} />
                      <div className="dropdown-panel" role="menu">
                        <Link to="/profile" className="dropdown-item" role="menuitem" onClick={() => setAccountMenuOpen(false)}>👤 Profile</Link>
                        <button className="dropdown-item dropdown-item-danger" role="menuitem" onClick={handleLogout} disabled={loggingOut}>
                          {loggingOut ? 'Signing out…' : '🚪 Sign Out'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
                <>
                  <Link to="/profile" className="btn btn-ghost btn-sm">👤 Profile</Link>
                  <button className="btn btn-ghost btn-sm" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? '…' : 'Sign Out'}</button>
                </>
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

    {/* Mobile bottom nav — one-tap access to the core actions, instead of
        requiring the hamburger menu for everything. Phone-width only
        (see .bottom-nav's media query); tablet/desktop keep using the
        top nav, which already has room for full labels. Logged-in only,
        since every destination here requires auth anyway. */}
    {isLoggedIn() && (
      <nav className="bottom-nav" aria-label="Primary">
        <Link to="/items" className={`bottom-nav-item ${location.pathname === '/items' ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🔍</span>
          <span>Browse</span>
        </Link>
        <Link to="/post-item" className={`bottom-nav-item ${location.pathname === '/post-item' ? 'active' : ''}`}>
          <span className="bottom-nav-icon">➕</span>
          <span>Report</span>
        </Link>
        <Link to="/messages" className={`bottom-nav-item ${location.pathname.startsWith('/messages') ? 'active' : ''}`}>
          <span className="bottom-nav-icon" style={{ position: 'relative' }}>
            💬
            {unreadCount > 0 && <span className="nav-badge" style={{ top: -4, right: -8 }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </span>
          <span>Chat</span>
        </Link>
        <Link to="/my-claims" className={`bottom-nav-item ${location.pathname === '/my-claims' ? 'active' : ''}`}>
          <span className="bottom-nav-icon" style={{ position: 'relative' }}>
            🙋
            {pendingClaimsCount > 0 && <span className="nav-badge" style={{ top: -4, right: -8 }}>{pendingClaimsCount > 9 ? '9+' : pendingClaimsCount}</span>}
          </span>
          <span>Claims</span>
        </Link>
        <Link to="/profile" className={`bottom-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}>
          <span className="bottom-nav-icon">👤</span>
          <span>Profile</span>
        </Link>
      </nav>
    )}
    </>
  );
}
