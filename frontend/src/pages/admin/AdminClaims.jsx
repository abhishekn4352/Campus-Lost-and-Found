import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import API from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { getErrorMessage } from '../../utils/errorMessage';
import { formatDate } from '../../utils/format';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import PageHeader from '../../components/PageHeader';
import AdminNav from '../../components/AdminNav';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import { StatusBadge } from '../../components/Badge';
import { EmptyState, ErrorState, PageLoader } from '../../components/States';

export default function AdminClaims() {
  useDocumentTitle('Admin · Claims');
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState({ claims: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await API.get('/admin/claims', { params: { status: status || undefined, page, limit: 20 } });
      setData(res);
    } catch (err) { setError(getErrorMessage(err, 'We couldn’t load claims.')); }
    finally { setLoading(false); }
  }, [status, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const act = async (claim, action) => {
    const approve = action === 'approve';
    const ok = await confirm({
      title: approve ? 'Approve this claim?' : 'Reject this claim?',
      message: approve ? `${claim.claimedBy?.name} will be confirmed as the owner of “${claim.itemId?.title}”.` : 'The claimant will be told it wasn’t approved.',
      confirmLabel: approve ? 'Approve' : 'Reject', danger: !approve,
    });
    if (!ok) return;
    setBusyId(claim._id);
    try {
      await API.put(`/admin/claims/${claim._id}/${action}`);
      showToast(approve ? 'Claim approved.' : 'Claim rejected.', 'success');
      await load();
    } catch (err) { showToast(getErrorMessage(err, 'That action failed.'), 'error'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="container page">
      <PageHeader title="Claims" subtitle={`${data.total} claim${data.total === 1 ? '' : 's'} shown.`} />
      <AdminNav />

      <div className="seg" role="group" aria-label="Filter by status" style={{ marginBottom: 20, maxWidth: 560 }}>
        {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([v, l]) => (
          <button key={l} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>

      {loading ? <PageLoader text="Loading claims…" /> : error ? <ErrorState message={error} onRetry={load} /> : data.claims.length === 0 ? (
        <EmptyState title="No claims here">Nothing matches this filter right now.</EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Claimant</th><th>Their explanation</th><th>Status</th><th>Sent</th><th className="t-right">Actions</th></tr></thead>
              <tbody>
                {data.claims.map((claim) => (
                  <tr key={claim._id}>
                    <td style={{ fontWeight: 600 }}>{claim.itemId?.title || 'Removed item'}<div className="cell-sub">Posted by {claim.itemId?.postedBy?.name || '—'}</div></td>
                    <td>{claim.claimedBy?.name}<div className="cell-sub">{claim.claimedBy?.email}</div></td>
                    <td style={{ maxWidth: 320, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{claim.message}</td>
                    <td><StatusBadge status={claim.status} /></td>
                    <td>{formatDate(claim.createdAt)}</td>
                    <td className="t-right">
                      {claim.status === 'pending' ? (
                        <div className="list-actions">
                          <Button size="sm" variant="success" icon={Check} disabled={busyId === claim._id} onClick={() => act(claim, 'approve')}>Approve</Button>
                          <Button size="sm" variant="danger" icon={X} disabled={busyId === claim._id} onClick={() => act(claim, 'reject')}>Reject</Button>
                        </div>
                      ) : <span className="muted">—</span>}
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
