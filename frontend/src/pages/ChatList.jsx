import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessage';
import { CATEGORY_ICONS } from '../constants';
import { assetUrl } from '../utils/assets';
import { timeAgo } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';

export default function ChatList() {
  useDocumentTitle('Messages');
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/messages/conversations');
      setConversations(data);
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t load your messages.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="container container-narrow page">
      <PageHeader title="Messages" subtitle="Chat to confirm details and arrange handovers." />

      {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={load} /> : conversations.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations yet" action={<Button to="/items" variant="primary">Browse items</Button>}>
          Open an item and choose “Message the finder” or “I found this” to start a private chat.
        </EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {conversations.map((conv) => {
            const other = conv.participants.find((p) => String(p._id) !== String(user?._id));
            const item = conv.itemId;
            const Icon = CATEGORY_ICONS[item?.category] || CATEGORY_ICONS.Other;
            const src = assetUrl(item?.imageUrl);
            const last = conv.lastMessage;
            return (
              <li key={conv._id}>
                <Link to={`/messages/${conv._id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="thumb">{src ? <img src={src} alt="" loading="lazy" /> : <Icon size={26} aria-hidden="true" />}</div>
                  <div className="list-main">
                    <div className="row spread">
                      <span className="list-title truncate" style={{ fontWeight: conv.unreadCount ? 700 : 600 }}>{other?.name || 'Student'}</span>
                      <span className="muted" style={{ fontSize: '0.8rem', flexShrink: 0 }}>{timeAgo(conv.updatedAt)}</span>
                    </div>
                    <div className="list-meta" style={{ marginTop: 0 }}><span className="truncate">About: {item?.title}</span></div>
                    <div className="truncate" style={{ color: conv.unreadCount ? 'var(--text)' : 'var(--text-3)', fontSize: '0.9rem', marginTop: 2 }}>
                      {last?.content || 'No messages yet — say hello.'}
                    </div>
                  </div>
                  {conv.unreadCount > 0 && <span className="unread-dot" aria-label={`${conv.unreadCount} unread`}>{conv.unreadCount}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
