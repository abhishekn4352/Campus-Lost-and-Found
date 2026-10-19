import { useCallback, useEffect, useState } from 'react';
import { Search, Ban, UserCheck } from 'lucide-react';
import API from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatDate, timeAgo, initials } from '../../utils/format';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import PageHeader from '../../components/PageHeader';
import AdminNav from '../../components/AdminNav';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import { Badge } from '../../components/Badge';
import { EmptyState, ErrorState, PageLoader } from '../../components/States';

export default function AdminUsers() {
  useDocumentTitle('Admin · Students');
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState({ users: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const q = useDebouncedValue(search.trim(), 350);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await API.get('/admin/users', { params: { q: q || undefined, page, limit: 20 } });
      setData(res);
    } catch (err) { setError(getErrorMessage(err, 'We couldn’t load students.')); }
    finally { setLoading(false); }
  }, [q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q]);

  const toggle = async (user) => {
    const suspending = user.isActive !== false;
    const ok = await confirm({
      title: suspending ? `Suspend ${user.name}?` : `Reinstate ${user.name}?`,
      message: suspending ? 'They won’t be able to log in or use the app until you reinstate them. Their posts stay up.' : 'They’ll be able to log in again.',
      confirmLabel: suspending ? 'Suspend account' : 'Reinstate', danger: suspending,
    });
    if (!ok) return;
    setBusyId(user._id);
    try {
      await API.put(`/admin/users/${user._id}/status`, { isActive: !suspending });
      showToast(suspending ? 'Account suspended.' : 'Account reinstated.', 'success');
      await load();
    } catch (err) { showToast(getErrorMessage(err, 'That action failed.'), 'error'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="container page">
      <PageHeader title="Students" subtitle={`${data.total} verified student${data.total === 1 ? '' : 's'}.`} />
      <AdminNav />

      <div className="field" style={{ maxWidth: 420 }}>
        <label className="label" htmlFor="adm-user-search">Search</label>
        <div className="input-icon"><Search size={18} aria-hidden="true" /><input id="adm-user-search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or college ID" /></div>
      </div>

      {loading ? <PageLoader text="Loading students…" /> : error ? <ErrorState message={error} onRetry={load} /> : data.users.length === 0 ? (
        <EmptyState title="No students found">Try a different search.</EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Student</th><th>College ID</th><th>Status</th><th>Last active</th><th>Joined</th><th className="t-right">Actions</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="row">
                        <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
                        <div><div style={{ fontWeight: 600 }}>{u.name}</div><div className="cell-sub">{u.email}</div></div>
                      </div>
                    </td>
                    <td>{u.collegeId}</td>
                    <td>{u.isActive === false ? <Badge kind="suspended">Suspended</Badge> : <Badge kind="approved">Active</Badge>}</td>
                    <td>{u.lastActive ? timeAgo(u.lastActive) : 'Never'}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td className="t-right">
                      <Button size="sm" variant={u.isActive === false ? 'success' : 'danger'} icon={u.isActive === false ? UserCheck : Ban} disabled={busyId === u._id} onClick={() => toggle(u)}>
                        {u.isActive === false ? 'Reinstate' : 'Suspend'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page || page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
