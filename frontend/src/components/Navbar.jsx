import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Search, Plus, MessageCircle, Inbox, User, LogOut, Sun, Moon, Menu, X,
  ShieldCheck, HandHelping,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationsContext';
import { initials, plural } from '../utils/format';
import Button from './Button';

const countLabel = (n) => (n > 9 ? '9+' : String(n));

function isActive(pathname, to) {
  return pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
}

export default function Navbar() {
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { unreadMessages, claimsToReview, myPendingClaims } = useNotifications();
  const [menu, setMenu] = useState(null); // 'account' | 'notifications' | null
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loggedIn = isLoggedIn();

  // Close menus/drawer on navigation.
  useEffect(() => { setMenu(null); setDrawerOpen(false); }, [pathname]);

  // Reserve room for the mobile bottom bar only when it is shown.
  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', loggedIn);
    return () => document.body.classList.remove('has-bottom-nav');
  }, [loggedIn]);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);

  const claimsBadge = claimsToReview + myPendingClaims;
  const totalNotifications = unreadMessages + claimsToReview;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      showToast('You have been signed out.', 'info');
      navigate('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const links = [
    ...(loggedIn ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
    { to: '/items', label: 'Browse' },
    ...(loggedIn ? [
      { to: '/my-posts', label: 'My posts' },
      { to: '/claims', label: 'Claims', count: claimsBadge },
      { to: '/messages', label: 'Messages', count: unreadMessages },
    ] : []),
    ...(isAdmin() ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  const renderLink = (link) => (
    <Link key={link.to} to={link.to} className="nav-link" aria-current={isActive(pathname, link.to) ? 'page' : undefined}>
      {link.label}
      {link.count > 0 && <span className="nav-count" aria-label={`${link.count} new`}>{countLabel(link.count)}</span>}
    </Link>
  );

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="nav">
        <div className="container nav-inner">
          <Link to={loggedIn ? '/dashboard' : '/'} className="brand" aria-label="Campus Lost & Found home">
            <span className="brand-mark" aria-hidden="true"><Search size={17} strokeWidth={2.6} /></span>
            <span>Lost &amp; Found</span>
          </Link>

          <nav className="nav-links" aria-label="Main">{links.map(renderLink)}</nav>

          <div className="nav-actions">
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            </button>

            {loggedIn ? (
              <>
                <Button to="/post-item" variant="primary" size="sm" icon={Plus} className="desktop-only">Report item</Button>

                <div className="menu-wrap">
                  <button
                    type="button" className="icon-btn"
                    onClick={() => setMenu((m) => (m === 'notifications' ? null : 'notifications'))}
                    aria-label={`Notifications${totalNotifications > 0 ? `, ${totalNotifications} unread` : ''}`}
                    aria-haspopup="true" aria-expanded={menu === 'notifications'}
                  >
                    <Bell size={20} aria-hidden="true" />
                    {totalNotifications > 0 && <span className="dot-badge" aria-hidden="true">{countLabel(totalNotifications)}</span>}
                  </button>
                  {menu === 'notifications' && (
                    <>
                      <div className="menu-overlay" onClick={() => setMenu(null)} />
                      <div className="menu" role="menu" aria-label="Notifications">
                        {unreadMessages + claimsToReview + myPendingClaims === 0 ? (
                          <div className="menu-empty">You’re all caught up</div>
                        ) : (
                          <>
                            {unreadMessages > 0 && (
                              <Link to="/messages" className="menu-item" role="menuitem">
                                <MessageCircle size={18} aria-hidden="true" /> {plural(unreadMessages, 'unread message')}
                              </Link>
                            )}
                            {claimsToReview > 0 && (
                              <Link to="/claims?tab=received" className="menu-item" role="menuitem">
                                <Inbox size={18} aria-hidden="true" /> {plural(claimsToReview, 'claim')} to review
                              </Link>
                            )}
                            {myPendingClaims > 0 && (
                              <Link to="/claims" className="menu-item" role="menuitem">
                                <HandHelping size={18} aria-hidden="true" /> {plural(myPendingClaims, 'claim')} awaiting a reply
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="menu-wrap desktop-only">
                  <button
                    type="button" className="account-btn"
                    onClick={() => setMenu((m) => (m === 'account' ? null : 'account'))}
                    aria-haspopup="true" aria-expanded={menu === 'account'} aria-label={`Account menu for ${user?.name}`}
                  >
                    <span className="avatar" aria-hidden="true">{initials(user?.name)}</span>
                    <span className="truncate" style={{ maxWidth: 110, fontWeight: 600, fontSize: '0.9rem' }}>{user?.name}</span>
                  </button>
                  {menu === 'account' && (
                    <>
                      <div className="menu-overlay" onClick={() => setMenu(null)} />
                      <div className="menu" role="menu">
                        <div className="menu-title truncate">{user?.email}</div>
                        <Link to="/profile" className="menu-item" role="menuitem"><User size={18} aria-hidden="true" /> Profile</Link>
                        {isAdmin() && <Link to="/admin" className="menu-item" role="menuitem"><ShieldCheck size={18} aria-hidden="true" /> Admin panel</Link>}
                        <button type="button" className="menu-item danger" role="menuitem" onClick={handleLogout} disabled={loggingOut}>
                          <LogOut size={18} aria-hidden="true" /> {loggingOut ? 'Signing out…' : 'Sign out'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Button to="/login" variant="ghost" size="sm">Log in</Button>
                <Button to="/register" variant="primary" size="sm" className="desktop-only">Create account</Button>
              </>
            )}

            <button
              type="button" className="icon-btn mobile-only"
              onClick={() => setDrawerOpen((o) => !o)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'} aria-expanded={drawerOpen} aria-controls="mobile-drawer"
            >
              {drawerOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="drawer mobile-only" id="mobile-drawer">
          {links.map(renderLink)}
          {loggedIn && <Link to="/profile" className="nav-link" aria-current={pathname === '/profile' ? 'page' : undefined}>Profile</Link>}
          <div className="drawer-foot">
            {loggedIn ? (
              <>
                <Button to="/post-item" variant="primary" icon={Plus}>Report item</Button>
                <Button icon={LogOut} onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Sign out'}</Button>
              </>
            ) : (
              <>
                <Button to="/register" variant="primary">Create account</Button>
                <Button to="/login">Log in</Button>
              </>
            )}
          </div>
        </div>
      )}

      {loggedIn && (
        <nav className="bottom-nav" aria-label="Primary">
          <Link to="/items" aria-current={pathname === '/items' ? 'page' : undefined}><Search size={22} aria-hidden="true" /><span>Browse</span></Link>
          <Link to="/post-item" aria-current={pathname === '/post-item' ? 'page' : undefined}><Plus size={22} aria-hidden="true" /><span>Report</span></Link>
          <Link to="/messages" aria-current={isActive(pathname, '/messages') ? 'page' : undefined}>
            <MessageCircle size={22} aria-hidden="true" /><span>Chat</span>
            {unreadMessages > 0 && <span className="dot-badge" aria-label={`${unreadMessages} unread`}>{countLabel(unreadMessages)}</span>}
          </Link>
          <Link to="/claims" aria-current={isActive(pathname, '/claims') ? 'page' : undefined}>
            <Inbox size={22} aria-hidden="true" /><span>Claims</span>
            {claimsBadge > 0 && <span className="dot-badge" aria-label={`${claimsBadge} pending`}>{countLabel(claimsBadge)}</span>}
          </Link>
          <Link to="/profile" aria-current={pathname === '/profile' ? 'page' : undefined}><User size={22} aria-hidden="true" /><span>Profile</span></Link>
        </nav>
      )}
    </>
  );
}
