import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import { getErrorMessage } from '../../utils/errorMessage';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import PageHeader from '../../components/PageHeader';
import AdminNav from '../../components/AdminNav';
import { ErrorState, PageLoader } from '../../components/States';

const CARDS = [
  { key: 'pendingClaims', label: 'Claims awaiting review', to: '/admin/claims', tone: 'var(--warn)' },
  { key: 'lost', label: 'Open lost items', to: '/admin/items', tone: 'var(--lost)' },
  { key: 'found', label: 'Open found items', to: '/admin/items', tone: 'var(--found)' },
  { key: 'claimed', label: 'Matched, awaiting handover' },
  { key: 'returned', label: 'Returned to owners' },
  { key: 'expired', label: 'Expired unclaimed' },
  { key: 'users', label: 'Verified students', to: '/admin/users' },
];

export default function AdminDashboard() {
  useDocumentTitle('Admin overview');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setStats((await API.get('/admin/dashboard')).data); }
    catch (err) { setError(getErrorMessage(err, 'We couldn’t load the overview.')); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="container page">
      <PageHeader title="Admin" subtitle="A quick look at how the board is doing." />
      <AdminNav />
      {error ? <ErrorState message={error} onRetry={load} /> : !stats ? <PageLoader text="Loading overview…" /> : (
        <div className="tiles">
          {CARDS.map((c) => {
            const body = (
              <>
                <div className="num" style={c.tone ? { color: c.tone } : undefined}>{stats[c.key] ?? 0}</div>
                <div className="lbl">{c.label}</div>
              </>
            );
            return c.to
              ? <Link key={c.key} to={c.to} className="tile" style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link>
              : <div key={c.key} className="tile">{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}
