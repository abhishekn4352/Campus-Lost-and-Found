import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Handshake, PackageCheck, Undo2, Inbox, ClipboardList, Pencil } from 'lucide-react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { getErrorMessage } from '../utils/errorMessage';
import { CATEGORY_ICONS } from '../constants';
import { assetUrl } from '../utils/assets';
import { formatDate, plural } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import { TypeBadge, StatusBadge, Badge } from '../components/Badge';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';

const FILTERS = ['All', 'Open', 'Claimed', 'Closed'];

export default function MyPosts() {
  useDocumentTitle('My posts');
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/items/my-posts');
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t load your posts.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (item) => {
    const ok = await confirm({ title: 'Delete this post?', message: `“${item.title}” and any claims or chats about it will be permanently removed.`, confirmLabel: 'Delete post', danger: true });
    if (!ok) return;
    setBusyId(item._id);
    try {
      await API.delete(`/items/${item._id}`);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      showToast('Post deleted.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'We couldn’t delete the post.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (item, status, { title, message, confirmLabel }) => {
    const ok = await confirm({ title, message, confirmLabel });
    if (!ok) return;
    setBusyId(item._id);
    try {
      await API.put(`/items/${item._id}`, { status });
      showToast('Post updated.', 'success');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'We couldn’t update the post.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const shown = items.filter((i) => filter === 'All' || i.status === filter);

  return (
    <div className="container page">
      <PageHeader title="My posts" subtitle="Items you’ve reported. Update them as things move along.">
        <Button to="/post-item" variant="primary" icon={Plus}>New report</Button>
      </PageHeader>

      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={load} /> : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="You haven’t posted anything yet" action={<Button to="/post-item" variant="primary">Report an item</Button>}>
          Lost or found something on campus? Put it on the board.
        </EmptyState>
      ) : (
        <>
          <div className="seg" role="group" aria-label="Filter by status" style={{ marginBottom: 20, maxWidth: 440 }}>
            {FILTERS.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'Claimed' ? 'Matched' : f}
              </button>
            ))}
          </div>

          {shown.length === 0 ? <p className="muted">No posts with this status.</p> : (
            <ul className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {shown.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.Other;
                const src = assetUrl(item.imageUrl);
                const busy = busyId === item._id;
                return (
                  <li key={item._id} className={`list-row ${item.pendingClaims ? 'is-pending' : ''}`}>
                    <div className="thumb">{src ? <img src={src} alt="" loading="lazy" /> : <Icon size={26} aria-hidden="true" />}</div>
                    <div className="list-main">
                      <Link to={`/items/${item._id}`} className="list-title truncate">{item.title}</Link>
                      <div className="list-meta">
                        <TypeBadge type={item.type} />
                        <StatusBadge status={item.status} />
                        {item.autoClosed && <Badge kind="cancelled">Expired</Badge>}
                        <span>{item.location}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      {item.pendingClaims > 0 && (
                        <Link to="/claims?tab=received" className="note" style={{ color: 'var(--warn)', fontWeight: 600 }}>
                          <Inbox size={16} aria-hidden="true" />{plural(item.pendingClaims, 'claim')} waiting for your decision
                        </Link>
                      )}
                    </div>
                    <div className="list-actions">
                      {item.status !== 'Closed' && (
                        <Button size="sm" icon={Pencil} to={`/items/${item._id}/edit`} aria-label={`Edit ${item.title}`}>Edit</Button>
                      )}
                      {item.status === 'Open' && (
                        <Button size="sm" variant="success" icon={Handshake} disabled={busy}
                          onClick={() => changeStatus(item, 'Claimed', { title: 'Mark as matched?', message: 'Use this when you’ve found who the item belongs to. Any pending claims will be closed.', confirmLabel: 'Mark as matched' })}>
                          Mark matched
                        </Button>
                      )}
                      {item.status === 'Claimed' && (
                        <>
                          <Button size="sm" variant="success" icon={PackageCheck} disabled={busy}
                            onClick={() => changeStatus(item, 'Closed', { title: 'Mark as returned?', message: 'This closes the post. Only do this once the item has actually been handed over.', confirmLabel: 'Mark returned' })}>
                            Mark returned
                          </Button>
                          <Button size="sm" icon={Undo2} disabled={busy}
                            onClick={() => changeStatus(item, 'Open', { title: 'Reopen this post?', message: 'The handover fell through? It goes back on the board for others to find.', confirmLabel: 'Reopen' })}>
                            Reopen
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => remove(item)} aria-label={`Delete ${item.title}`}>Delete</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
