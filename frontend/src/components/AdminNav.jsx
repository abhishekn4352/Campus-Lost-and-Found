import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: 'Overview' },
  { to: '/admin/items', label: 'Items' },
  { to: '/admin/claims', label: 'Claims' },
  { to: '/admin/users', label: 'Students' },
];

export default function AdminNav() {
  const { pathname } = useLocation();
  return (
    <nav className="tabs" aria-label="Admin sections">
      {TABS.map((t) => (
        <Link key={t.to} to={t.to} className="tab" aria-current={pathname === t.to ? 'page' : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
