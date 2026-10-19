import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X, Undo2, MessageCircle, Inbox, HandHelping } from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useNotifications } from '../context/NotificationsContext';
import { getErrorMessage } from '../utils/errorMessage';
import { CATEGORY_ICONS } from '../constants';
import { assetUrl } from '../utils/assets';
import { timeAgo } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Button from '../components/Button';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { StatusBadge, TypeBadge } from '../components/Badge';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';

function Thumb({ item }) {
  const Icon = CATEGORY_ICONS[item?.category] || CATEGORY_ICONS.Other;
  const src = assetUrl(item?.imageUrl);
  return <div className="thumb">{src ? <img src={src} alt="" loading="lazy" /> : <Icon size={26} aria-hidden="true" />}</div>;
}

function RejectDialog({ claim, onClose, onConfirm }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); await onConfirm(note); setBusy(false); };
  return (
    <Modal title="Reject this claim?" onClose={onClose}>
      <p className="muted">{claim.claimedBy?.name} will be told it wasn’t approved. You can add a short reason (optional).</p>
      <form onSubmit={submit} className="mt-4">
        <div className="field">
          <label className="label" htmlFor="reject-note">Reason <span className="optional">(optional)</span></label>
          <textarea id="reject-note" className="textarea" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} data-autofocus placeholder="e.g. The item doesn’t match that description." />
        </div>
        <div className="modal-actions">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="danger" loading={busy}>Reject claim</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Claims() {
  useDocumentTitle('Claims');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'received' ? 'received' : 'mine';
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { claimsToReview, myPendingClaims, refresh } = useNotifications();

  const [mine, setMine] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, r] = await Promise.all([API.get('/claims/my-claims'), API.get('/claims/received')]);
      setMine(m.data);
      setReceived(r.data);
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t load your claims.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const withdraw = async (claim) => {
    const ok = await confirm({ title: 'Withdraw this claim?', message: 'The finder will no longer see it.', confirmLabel: 'Withdraw', danger: true });
    if (!ok) return;
    setBusyId(claim._id);
    try {
      await API.delete(`/claims/${claim._id}`);
      showToast('Claim withdrawn.', 'success');
      await load(); refresh();
    } catch (err) { showToast(getErrorMessage(err, 'We couldn’t withdraw the claim.'), 'error'); }
    finally { setBusyId(null); }
  };

  const approve = async (claim) => {
    const ok = await confirm({
      title: 'Approve this claim?',
      message: `You’re confirming that ${claim.claimedBy?.name} is the owner of “${claim.itemId?.title}”. Other pending claims on it will be closed and a chat will open so you can arrange the handover.`,
      confirmLabel: 'Approve claim',
    });
    if (!ok) return;
    setBusyId(claim._id);
    try {
      const { data } = await API.put(`/claims/${claim._id}/respond`, { action: 'approve' });
      showToast('Claim approved.', 'success');
      refresh();
      navigate(data.conversationId ? `/messages/${data.conversationId}` : '/messages');
    } catch (err) {
      showToast(getErrorMessage(err, 'We couldn’t approve the claim.'), 'error');
      setBusyId(null);
    }
  };

  const reject = async (note) => {
    try {
      await API.put(`/claims/${rejecting._id}/respond`, { action: 'reject', note });
      showToast('Claim rejected.', 'success');
      setRejecting(null);
      await load(); refresh();
    } catch (err) {
      showToast(getErrorMessage(err, 'We couldn’t reject the claim.'), 'error');
    }
  };

  const setTab = (t) => setParams(t === 'received' ? { tab: 'received' } : {}, { replace: true });

  return (
    <div className="container container-narrow page">
      <PageHeader title="Claims" subtitle="Requests to take ownership of found items — the ones you sent and the ones you’ve received." />

      <div className="tabs" role="tablist" aria-label="Claims">
        <button type="button" role="tab" className="tab" aria-selected={tab === 'mine'} onClick={() => setTab('mine')}>
          I claimed {myPendingClaims > 0 && <span className="nav-count">{myPendingClaims}</span>}
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'received'} onClick={() => setTab('received')}>
          On my items {claimsToReview > 0 && <span className="nav-count">{claimsToReview}</span>}
        </button>
      </div>

      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={load} /> : tab === 'mine' ? (
        mine.length === 0 ? (
          <EmptyState icon={HandHelping} title="You haven’t claimed anything" action={<Button to="/items?type=found" variant="primary">Browse found items</Button>}>
            If you spot something of yours among the found items, open it and choose “This is mine”.
          </EmptyState>
        ) : (
          <ul className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {mine.map((claim) => (
              <li key={claim._id} className={`list-row ${claim.status === 'pending' ? 'is-pending' : ''}`} style={{ alignItems: 'flex-start' }}>
                <Thumb item={claim.itemId} />
                <div className="list-main">
                  {claim.itemId ? <Link to={`/items/${claim.itemId._id}`} className="list-title truncate">{claim.itemId.title}</Link> : <span className="list-title">Item removed</span>}
                  <div className="list-meta"><StatusBadge status={claim.status} /><span>Sent {timeAgo(claim.createdAt)}</span></div>
                  <p className="claim-quote">{claim.message}</p>
                  {claim.responseNote && <p className="note"><MessageCircle size={16} aria-hidden="true" />Finder’s note: {claim.responseNote}</p>}
                </div>
                <div className="list-actions">
                  {claim.status === 'pending' && <Button size="sm" icon={Undo2} disabled={busyId === claim._id} onClick={() => withdraw(claim)}>Withdraw</Button>}
                  {claim.status === 'approved' && <Button size="sm" variant="primary" icon={MessageCircle} to="/messages">Arrange handover</Button>}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : received.length === 0 ? (
        <EmptyState icon={Inbox} title="No claims on your items yet">When someone thinks a found item you posted is theirs, their claim will show up here.</EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {received.map((claim) => (
            <li key={claim._id} className={`list-row ${claim.status === 'pending' ? 'is-pending' : ''}`} style={{ alignItems: 'flex-start' }}>
              <Thumb item={claim.itemId} />
              <div className="list-main">
                {claim.itemId ? <Link to={`/items/${claim.itemId._id}`} className="list-title truncate">{claim.itemId.title}</Link> : <span className="list-title">Item removed</span>}
                <div className="list-meta">
                  {claim.itemId && <TypeBadge type={claim.itemId.type} />}<StatusBadge status={claim.status} />
                  <span>{claim.claimedBy?.name || 'A student'} · {timeAgo(claim.createdAt)}</span>
                </div>
                <p className="claim-quote">{claim.message}</p>
              </div>
              {claim.status === 'pending' && (
                <div className="list-actions">
                  <Button size="sm" variant="success" icon={Check} disabled={busyId === claim._id} onClick={() => approve(claim)}>Approve</Button>
                  <Button size="sm" variant="danger" icon={X} disabled={busyId === claim._id} onClick={() => setRejecting(claim)}>Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {rejecting && <RejectDialog claim={rejecting} onClose={() => setRejecting(null)} onConfirm={reject} />}
    </div>
  );
}
