import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export default function ItemDetail() {
  const { id } = useParams();
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [item, setItem]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    API.get(`/items/${id}`)
      .then(({ data }) => { setItem(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const handleContact = async () => {
    if (!isLoggedIn()) return navigate('/login');
    setClaiming(true);
    try {
      // Start or get conversation
      await API.post('/messages/send', {
        itemId: id,
        receiverId: item.postedBy._id,
        content: `Hi, I'm interested in the item: ${item.title}`
      });
      
      // Get the conversation to find its ID (or simplify the backend to return it)
      const { data: convs } = await API.get('/messages/conversations');
      const conv = convs.find(c => c.itemId._id === id && c.participants.some(p => p._id === item.postedBy._id));
      
      if (conv) {
        navigate(`/messages/${conv._id}`);
      } else {
        setMsg('Conversation started. Check your messages.');
      }
    } catch (err) {
      setMsg(err.response?.data?.message || 'Error initializing contact');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <Spinner text="Loading item details…" />;

  if (!item) return (
    <div className="page-wrap">
      <div className="empty-state">
        <div className="empty-state-icon">😕</div>
        <div className="empty-state-title">Item Not Found</div>
        <p className="empty-state-sub">This item may have been removed or the link is incorrect.</p>
        <Link to="/items" className="btn btn-neon">Browse All Items</Link>
      </div>
    </div>
  );

  const isOwner = user?._id?.toString() === item.postedBy._id?.toString();
  const imgSrc  = item.imageUrl
    ? `${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`
    : null;

  const fmtDate = d => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="page-wrap">
      {/* Back */}
      <Link to="/items" className="btn btn-ghost btn-sm" style={{ marginBottom: 20, display: 'inline-flex' }}>
        ← Back to items
      </Link>

      <div className="row g-4 justify-content-center">
        <div className="col-lg-8">
          {/* Image */}
          {imgSrc ? (
            <img src={imgSrc} alt={item.title} className="detail-img" />
          ) : (
            <div style={{ height: 220, background: 'var(--ink-3)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', marginBottom: 20 }}>
              📦
            </div>
          )}

          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className={`badge-pill ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
              {item.type === 'lost' ? '● Lost' : '● Found'}
            </span>
            <span className={`badge-pill badge-${item.status?.toLowerCase()}`}>{item.status}</span>
            <span className="badge-pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {item.category}
            </span>
          </div>

          {/* Title & Description */}
          <h1 className="detail-title">{item.title}</h1>
          <p style={{ color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 24, fontWeight: 300 }}>
            {item.description}
          </p>

          {/* Meta Grid */}
          <div className="meta-grid">
            {[
              { lbl: 'Location',    val: item.location },
              { lbl: 'Date',        val: fmtDate(item.lostFoundDate) },
              { lbl: 'Posted By',   val: item.postedBy.name },
              { lbl: 'Expires',     val: fmtDate(item.expiresAt) },
            ].map(m => (
              <div key={m.lbl} className="meta-block">
                <div className="meta-block-lbl">{m.lbl}</div>
                <div className="meta-block-val">{m.val}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {msg && (
            <div className="alert-box alert-warn" style={{ marginTop: 16 }}>⚠️ {msg}</div>
          )}

          {!isOwner && (item.status === 'Open' || item.status === 'active') && (
            <div style={{ marginTop: 24 }}>
              <button
                className="btn btn-neon btn-full btn-lg"
                onClick={handleContact}
                disabled={claiming}
              >
                {claiming
                  ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Processing…</>
                  : '✉️ Send Secure Message to Owner'}
              </button>
              <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'center' }}>
                🔒 Your contact info is safe. You can choose to share it within the chat once you've connected.
              </p>
            </div>
          )}

          {isOwner && (
            <div className="alert-box alert-info" style={{ marginTop: 16 }}>
              ℹ️ This is your post. Go to <Link to="/my-posts" className="auth-link">My Posts</Link> to manage its status.
            </div>
          )}

          {item.status === 'Claimed' && (
            <div className="alert-box alert-warn" style={{ marginTop: 16 }}>
              🤝 This item has been matched and is currently being claimed.
            </div>
          )}

          {(item.status === 'Closed' || item.status === 'claimed') && (
            <div className="alert-box alert-ok" style={{ marginTop: 16 }}>
              ✅ This item has been successfully returned and closed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
