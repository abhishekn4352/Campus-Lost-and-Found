import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Lock, Handshake, ExternalLink, MessageCircle } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationsContext';
import { getErrorMessage } from '../utils/errorMessage';
import { formatTime } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Button from '../components/Button';
import { EmptyState, ErrorState, PageLoader } from '../components/States';

const POLL_MS = 6000;
const dayLabel = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

export default function ChatWindow() {
  const { id: convId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { refresh: refreshNotifications } = useNotifications();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const bodyRef = useRef(null);
  const stickToBottom = useRef(true);
  const lastTimestamp = useRef(null);

  useDocumentTitle(conversation?.itemId?.title ? `Chat · ${conversation.itemId.title}` : 'Chat');

  const mergeMessages = useCallback((incoming) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m._id));
      const fresh = incoming.filter((m) => !seen.has(m._id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastTimestamp.current = incoming[incoming.length - 1].createdAt;
  }, []);

  const loadConversation = useCallback(async () => {
    const { data } = await API.get(`/messages/conversations/${convId}`);
    setConversation(data);
  }, [convId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    setMissing(false);
    try {
      const [, msgRes] = await Promise.all([loadConversation(), API.get(`/messages/${convId}`)]);
      setMessages(msgRes.data);
      lastTimestamp.current = msgRes.data.length ? msgRes.data[msgRes.data.length - 1].createdAt : null;
      refreshNotifications();
    } catch (err) {
      if ([403, 404].includes(err.response?.status)) setMissing(true);
      else setError(getErrorMessage(err, 'We couldn’t open this conversation.'));
    } finally {
      setLoading(false);
    }
  }, [convId, loadConversation, refreshNotifications]);

  useEffect(() => { setMessages([]); loadAll(); }, [loadAll]);

  // Poll for new messages (and the other person's sharing choice) while the
  // tab is visible. Only messages newer than the last one seen are fetched.
  useEffect(() => {
    if (loading || missing || error) return undefined;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const params = lastTimestamp.current ? { after: lastTimestamp.current } : {};
        const [msgRes] = await Promise.all([API.get(`/messages/${convId}`, { params }), loadConversation()]);
        if (msgRes.data.length) { mergeMessages(msgRes.data); refreshNotifications(); }
      } catch { /* a failed poll is retried on the next tick */ }
    };
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [convId, loading, missing, error, loadConversation, mergeMessages, refreshNotifications]);

  // Keep the view pinned to the newest message unless the reader scrolled up.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, conversation?.bothShared]);
  const onScroll = () => {
    const el = bodyRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async (e) => {
    e?.preventDefault();
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { data } = await API.post('/messages/send', { conversationId: convId, content: text });
      stickToBottom.current = true;
      mergeMessages([data]);
      setContent('');
    } catch (err) {
      showToast(getErrorMessage(err, 'Your message wasn’t sent.'), 'error');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const toggleShare = async () => {
    setSharing(true);
    try {
      await API.post('/messages/share-contact', { conversationId: convId });
      await loadConversation();
    } catch (err) {
      showToast(getErrorMessage(err, 'We couldn’t update your sharing choice.'), 'error');
    } finally {
      setSharing(false);
    }
  };

  if (loading) return <div className="container page"><PageLoader text="Opening conversation…" /></div>;
  if (missing) return <div className="container container-narrow page"><EmptyState icon={MessageCircle} title="Conversation not found" action={<Button to="/messages" variant="primary">Back to messages</Button>}>It may have been removed along with its item.</EmptyState></div>;
  if (error) return <div className="container container-narrow page"><ErrorState message={error} onRetry={loadAll} /></div>;

  const other = conversation.participants.find((p) => String(p._id) !== String(user._id));
  const myShare = conversation.shares.find((s) => String(s.userId?._id || s.userId) === String(user._id));
  const item = conversation.itemId;
  let lastDay = '';

  return (
    <div className="container chat-page">
      <div className="chat">
        <div className="chat-head">
          <Button to="/messages" variant="ghost" size="sm" aria-label="Back to messages"><ArrowLeft size={18} aria-hidden="true" /></Button>
          <div className="grow">
            <div style={{ fontWeight: 700 }} className="truncate">{other?.name || 'Student'}</div>
            <div className="muted truncate" style={{ fontSize: '0.85rem' }}>About: {item.title}</div>
          </div>
          <Link to={`/items/${item._id}`} className="btn btn-ghost btn-sm">View item<ExternalLink size={16} aria-hidden="true" /></Link>
        </div>

        <div className="chat-body" ref={bodyRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Messages">
          {conversation.bothShared ? (
            <div className="contact-card">
              <strong><Handshake size={16} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> You both shared contact details</strong>
              <dl>
                <div><dt>Email</dt><dd>{other?.email || '—'}</dd></div>
                <div><dt>Phone</dt><dd>{other?.phone || '—'}</dd></div>
              </dl>
            </div>
          ) : (
            <div className="privacy-card">
              <Lock size={18} aria-hidden="true" />
              <span>Contact details are hidden. Phone and email are shown only when <strong>both</strong> of you choose to share them.</span>
            </div>
          )}

          {messages.length === 0 && <p className="muted" style={{ textAlign: 'center', margin: 'auto' }}>No messages yet. Say hello and describe the item.</p>}

          {messages.map((m) => {
            const mine = String(m.sender?._id || m.sender) === String(user._id);
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m._id} style={{ display: 'contents' }}>
                {showDay && <div className="chat-day">{day}</div>}
                <div className={`bubble-wrap ${mine ? 'me' : 'them'}`}>
                  <div className="bubble">{m.content}</div>
                  <div className="bubble-time">{formatTime(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="chat-foot">
          <div style={{ marginBottom: 10 }}>
            <Button size="sm" variant={myShare?.shared ? 'success' : 'secondary'} onClick={toggleShare} loading={sharing} aria-pressed={!!myShare?.shared}>
              {myShare?.shared ? 'You’re sharing your contact — tap to stop' : 'Share my contact details'}
            </Button>
          </div>
          <form className="chat-form" onSubmit={send}>
            <label htmlFor="chat-input" className="sr-only">Message</label>
            <textarea id="chat-input" className="textarea" rows={1} value={content} maxLength={2000} placeholder="Write a message…" onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown} />
            <Button type="submit" variant="primary" disabled={!content.trim()} loading={sending} aria-label="Send message"><Send size={18} aria-hidden="true" /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
