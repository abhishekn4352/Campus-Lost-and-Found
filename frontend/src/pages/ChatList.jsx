import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export default function ChatList() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/messages/conversations')
      .then(({ data }) => { setConversations(data); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, []);

  if (loading) return <Spinner text="Loading your messages..." />;

  return (
    <div className="page-wrap" style={{ maxWidth: '800px' }}>
      <div className="pg-header">
        <div className="pg-kicker">Secure Communication</div>
        <h1 className="pg-title">My Messages</h1>
        <p className="pg-sub">Coordinate handovers and verify items</p>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <div className="empty-state-title">No conversations yet</div>
          <p className="empty-state-sub">Start a chat from any item's detail page to coordinate a return.</p>
          <Link to="/items" className="btn btn-neon">Browse All Items</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {conversations.map((conv, i) => {
            const otherUser = conv.participants.find(p => p._id !== user?._id);
            const item = conv.itemId;
            const lastMsg = conv.lastMessage;
            
            return (
              <Link 
                to={`/messages/${conv._id}`} 
                key={conv._id} 
                className="claim-row anim-up" 
                style={{ 
                  animationDelay: `${i * 0.05}s`, 
                  textDecoration: 'none', 
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}
              >
                {/* Item Thumbnail */}
                <div className="claim-thumb" style={{ width: '60px', height: '60px', borderRadius: '8px', flexShrink: 0 }}>
                  {item?.imageUrl ? (
                    <img src={`${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : <span>📦</span>}
                </div>

                {/* Content */}
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>
                      {otherUser?.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--neon)', fontWeight: 500, marginBottom: '2px' }}>
                    Re: {item?.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lastMsg?.content || 'Started a conversation...'}
                  </div>
                </div>

                {/* Chevron */}
                <div style={{ color: 'var(--text-3)', fontSize: '1.2rem' }}>›</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
