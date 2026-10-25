import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { MapPin, Calendar, User, Hourglass, MessageCircle, HandHelping, ArrowLeft, Lock, PackageSearch, Undo2, Pencil } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useNotifications } from '../context/NotificationsContext';
import { getErrorMessage } from '../utils/errorMessage';
import { formatDate } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ItemMedia } from '../components/ItemCard';
import { TypeBadge, StatusBadge } from '../components/Badge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { Alert, EmptyState, ErrorState, PageLoader } from '../components/States';

const MAX_CLAIM = 500;

function ClaimDialog({ item, onClose, onSubmitted }) {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = message.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (trimmed.length < 10) return setError('Add a few more details so the finder can check (at least 10 characters).');
    setBusy(true);
    setError('');
    try {
      const { data } = await API.post(`/claims/request/${item._id}`, { message: trimmed });
      showToast('Claim sent. You’ll be notified when the finder replies.', 'success');
      onSubmitted(data.claim);
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t send your claim.'));
      setBusy(false);
    }
  };

  return (
    <Modal title="Claim this item" onClose={onClose}>
      <p className="muted">Describe something only the owner would know — marks, contents, when and where you lost it. The finder will review this before anything is handed over.</p>
      <form onSubmit={submit} noValidate className="mt-4">
        {error && <Alert type="error">{error}</Alert>}
        <div className="field">
          <label className="label" htmlFor="claim-message">How can you prove it’s yours?</label>
          <textarea
            id="claim-message" className="textarea" rows={5} maxLength={MAX_CLAIM} data-autofocus
            value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Blue case with a cracked corner, my library card is inside, lost near Block B on Monday."
          />
          <div className="field-meta"><span className="hint">Don’t include your phone number — you can share it later in chat.</span><span className="hint">{message.length}/{MAX_CLAIM}</span></div>
        </div>
        <div className="modal-actions">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>Send claim</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ItemDetail() {
  const { id } = useParams();
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { refresh: refreshNotifications } = useNotifications();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useDocumentTitle(item?.title);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const { data } = await API.get(`/items/${id}`);
      setItem(data);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else setError(getErrorMessage(err, 'We couldn’t load this item.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const requireLogin = () => navigate('/login', { state: { from: location.pathname } });

  const startChat = async () => {
    if (!isLoggedIn()) return requireLogin();
    setStarting(true);
    try {
      const { data } = await API.post('/messages/start', { itemId: id });
      navigate(`/messages/${data.conversationId}`);
    } catch (err) {
      showToast(getErrorMessage(err, 'We couldn’t open the chat.'), 'error');
      setStarting(false);
    }
  };

  const withdraw = async () => {
    const ok = await confirm({ title: 'Withdraw your claim?', message: 'The finder will no longer see it. You can claim again later.', confirmLabel: 'Withdraw claim', danger: true });
    if (!ok) return;
    setWithdrawing(true);
    try {
      await API.delete(`/claims/${item.myClaim._id}`);
      showToast('Claim withdrawn.', 'success');
      refreshNotifications();
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'We couldn’t withdraw the claim.'), 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) return <div className="container page"><PageLoader text="Loading item…" /></div>;
  if (notFound) {
    return (
      <div className="container container-narrow page">
        <EmptyState icon={PackageSearch} title="This item isn’t here any more" action={<Button to="/items" variant="primary">Browse items</Button>}>
          It may have been returned, expired, or removed by the person who posted it.
        </EmptyState>
      </div>
    );
  }
  if (error) return <div className="container container-narrow page"><ErrorState message={error} onRetry={load} /></div>;

  const isOwner = !!user && String(user._id) === String(item.postedBy?._id);
  const open = item.status === 'Open';
  const myClaim = item.myClaim;

  return (
    <div className="container page">
      <Button to="/items" variant="ghost" size="sm" icon={ArrowLeft} className="mt-2">All items</Button>

      <div className="detail mt-4">
        <ItemMedia item={item} className="detail-media d-media" size={72} />

        <aside className="d-aside">
          <div className="panel">
            <div className="row row-wrap" style={{ gap: 8 }}>
              <TypeBadge type={item.type} />
              <StatusBadge status={item.status} />
              <span className="muted" style={{ fontSize: '0.875rem' }}>{item.category}</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3.4vw, 2.2rem)', marginTop: 12 }}>{item.title}</h1>

            <dl className="facts">
              <div><MapPin size={18} aria-hidden="true" /><span><dt>{item.type === 'lost' ? 'Lost near' : 'Found at'}</dt><dd>{item.location}</dd></span></div>
              <div><Calendar size={18} aria-hidden="true" /><span><dt>Date</dt><dd>{formatDate(item.lostFoundDate, { year: 'numeric', month: 'long', day: 'numeric' })}</dd></span></div>
              <div><User size={18} aria-hidden="true" /><span><dt>Posted by</dt><dd>{item.postedBy?.name || 'A student'}</dd></span></div>
              {open && <div><Hourglass size={18} aria-hidden="true" /><span><dt>Stays on the board until</dt><dd>{formatDate(item.expiresAt)}</dd></span></div>}
            </dl>
          </div>

          <div className="panel">
            {isOwner ? (
              <>
                <Alert type="info">This is your post. Manage its status and review claims from your posts.</Alert>
                <div className="row row-wrap">
                  {item.status !== 'Closed' && <Button to={`/items/${item._id}/edit`} variant="primary" icon={Pencil}>Edit post</Button>}
                  <Button to="/my-posts">Manage my posts</Button>
                  {item.type === 'found' && <Button to="/claims?tab=received">Review claims</Button>}
                </div>
              </>
            ) : !open ? (
              <Alert type={item.status === 'Closed' ? 'success' : 'warning'}>
                {item.status === 'Closed' ? 'This item has been returned or closed.' : 'This item has been matched and is waiting for handover.'}
              </Alert>
            ) : !isLoggedIn() ? (
              <>
                <p className="muted" style={{ marginBottom: 16 }}>Log in to {item.type === 'found' ? 'claim this item or message the finder' : 'tell the owner you found it'}.</p>
                <Button variant="primary" block size="lg" onClick={requireLogin}>Log in to continue</Button>
              </>
            ) : item.type === 'found' ? (
              <div className="stack" style={{ gap: 12 }}>
                {myClaim?.status === 'pending' ? (
                  <>
                    <Alert type="info">Your claim is waiting for the finder’s review.</Alert>
                    <Button icon={Undo2} onClick={withdraw} loading={withdrawing}>Withdraw claim</Button>
                  </>
                ) : (
                  <>
                    {myClaim?.status === 'rejected' && (
                      <Alert type="warning">Your earlier claim wasn’t approved{myClaim.responseNote ? `: “${myClaim.responseNote}”` : '.'} You can send a new one with more detail.</Alert>
                    )}
                    <Button variant="primary" size="lg" block icon={HandHelping} onClick={() => setClaimOpen(true)}>This is mine — claim it</Button>
                  </>
                )}
                <Button block icon={MessageCircle} onClick={startChat} loading={starting}>Message the finder</Button>
              </div>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                <Button variant="primary" size="lg" block icon={MessageCircle} onClick={startChat} loading={starting}>I found this</Button>
                <p className="muted" style={{ fontSize: '0.875rem' }}>This opens a private chat with the owner so you can describe where it is.</p>
              </div>
            )}
            {isLoggedIn() && !isOwner && open && (
              <p className="note"><Lock size={16} aria-hidden="true" />Your phone and email stay hidden unless you both choose to share them in chat.</p>
            )}
          </div>
        </aside>

        <section className="panel d-desc" aria-labelledby="desc-h">
          <h2 id="desc-h" style={{ fontSize: '1.15rem' }}>Description</h2>
          <p className="prose">{item.description}</p>
        </section>
      </div>

      {claimOpen && (
        <ClaimDialog
          item={item}
          onClose={() => setClaimOpen(false)}
          onSubmitted={(claim) => { setClaimOpen(false); setItem((prev) => ({ ...prev, myClaim: claim })); refreshNotifications(); }}
        />
      )}
    </div>
  );
}
