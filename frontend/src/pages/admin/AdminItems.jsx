import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Trash2 } from 'lucide-react';
import API from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatDate } from '../../utils/format';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import PageHeader from '../../components/PageHeader';
import AdminNav from '../../components/AdminNav';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import { TypeBadge, StatusBadge } from '../../components/Badge';
import { EmptyState, ErrorState, PageLoader } from '../../components/States';

export default function AdminItems() {
  useDocumentTitle('Admin · Items');
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const q = useDebouncedValue(search.trim(), 350);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await API.get('/admin/items', { params: { q: q || undefined, status: status || undefined, type: type || undefined, page, limit: 20 } });
      setData(res);
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t load items.'));
    } finally { setLoading(false); }
  }, [q, status, type, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, status, type]);

  const remove = async (item) => {
    const ok = await confirm({ title: 'Delete this item?', message: `“${item.title}” and its claims and chats will be permanently removed.`, confirmLabel: 'Delete item', danger: true });
    if (!ok) return;
    setBusyId(item._id);
    try {
      await API.delete(`/admin/items/${item._id}`);
      showToast('Item deleted.', 'success');
      await load();
    } catch (err) { showToast(getErrorMessage(err, 'We couldn’t delete the item.'), 'error'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="container page">
      <PageHeader title="Items" subtitle={`${data.total} item${data.total === 1 ? '' : 's'} match.`} />
      <AdminNav />

      <div className="filters">
        <div className="filters-grid" style={{ gridTemplateColumns: undefined }}>
          <div className="field">
            <label className="label" htmlFor="adm-search">Search</label>
            <div className="input-icon"><Search size={18} aria-hidden="true" /><input id="adm-search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, category, location or poster" /></div>
          </div>
          <div className="field">
            <label className="label" htmlFor="adm-type">Type</label>
            <select id="adm-type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option><option value="lost">Lost</option><option value="found">Found</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="adm-status">Status</label>
            <select id="adm-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option><option value="Open">Open</option><option value="Claimed">Matched</option><option value="Closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? <PageLoader text="Loading items…" /> : error ? <ErrorState message={error} onRetry={load} /> : data.items.length === 0 ? (
        <EmptyState title="No items found">Try changing the search or filters.</EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Posted by</th><th>Posted</th><th className="t-right">Actions</th></tr></thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item._id}>
                    <td><Link to={`/items/${item._id}`} style={{ fontWeight: 600 }}>{item.title}</Link><div className="cell-sub">{item.category} · {item.location}</div></td>
                    <td><TypeBadge type={item.type} /></td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>{item.postedBy?.name || '—'}<div className="cell-sub">{item.postedBy?.email}</div></td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td className="t-right"><Button size="sm" variant="danger" icon={Trash2} disabled={busyId === item._id} onClick={() => remove(item)} aria-label={`Delete ${item.title}`}>Delete</Button></td>
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
