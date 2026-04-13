import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

export default function ChatWindow() {
  const { id: convId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const scrollRef = useRef();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds for basic "neat working" real-time
    return () => clearInterval(interval);
  }, [convId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    try {
      const [msgRes, convsRes] = await Promise.all([
        API.get(`/messages/${convId}`),
        API.get('/messages/conversations')
      ]);
      setMessages(msgRes.data);
      const currentConv = convsRes.data.find(c => c._id === convId);
      setConversation(currentConv);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      const otherParticipant = conversation.participants.find(p => p._id !== user._id);
      const { data } = await API.post('/messages/send', {
        convId,
        itemId: conversation.itemId._id,
        receiverId: otherParticipant._id,
        content
      });
      setMessages([...messages, data]);
      setContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareToggle = async () => {
    setSharing(true);
    try {
      await API.post('/messages/share-contact', { conversationId: convId });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSharing(false);
    }
  };

  if (loading) return <Spinner text="Opening conversation..." />;
  if (!conversation) return <div className="page-wrap"><p>Conversation not found.</p></div>;

  const otherUser = conversation.participants.find(p => p._id !== user._id);
  const myShare = conversation.shares.find(s => s.userId === user._id || s.userId?._id === user._id);
  const bothShared = conversation.shares.every(s => s.shared === true);
  const item = conversation.itemId;

  return (
    <div className="page-wrap chat-container" style={{ maxWidth: '800px', height: '85vh', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Header */}
      <div className="chat-header" style={{ padding: '16px 20px', background: 'var(--ink-2)', border: '1px solid var(--border)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/messages" className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>←</Link>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{otherUser.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Talking about: <span style={{ color: 'var(--neon)' }}>{item.title}</span></div>
          </div>
        </div>
        <Link to={`/items/${item._id}`} className="btn btn-ghost btn-sm">View Item</Link>
      </div>

      {/* Messages Area */}
      <div className="chat-messages" style={{ flexGrow: 1, overflowY: 'auto', padding: '20px', background: 'var(--ink-1)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Contact info card if shared */}
        {bothShared ? (
          <div className="anim-in" style={{ padding: '16px', background: 'var(--neon-dim)', border: '2px solid var(--neon)', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🤝 Contact Info Shared</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>EMAIL</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{otherUser.email}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>PHONE</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{otherUser.phone || 'N/A'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px', background: 'var(--ink-3)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-3)', border: '1px dashed var(--border)', marginBottom: '10px' }}>
            🔒 Contact information is hidden. Click "Share My Contact" to reveal details when both parties agree.
          </div>
        )}

        {messages.map((m, i) => {
          const isMe = m.sender === user._id || m.sender?._id === user._id;
          return (
            <div key={m._id} className={`chat-bubble-wrap ${isMe ? 'me' : 'them'}`} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              <div className={`chat-bubble ${isMe ? 'chat-me' : 'chat-them'}`} style={{ 
                maxWidth: '70%', 
                padding: '10px 16px', 
                borderRadius: '18px', 
                background: isMe ? 'var(--neon)' : 'var(--ink-3)', 
                color: isMe ? '#000' : 'var(--text)',
                fontWeight: isMe ? 600 : 400,
                fontSize: '0.95rem',
                border: isMe ? 'none' : '1px solid var(--border)',
                borderBottomRightRadius: isMe ? '4px' : '18px',
                borderBottomLeftRadius: isMe ? '18px' : '4px'
              }}>
                {m.content}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '4px', padding: '0 8px' }}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="chat-footer" style={{ padding: '16px 20px', background: 'var(--ink-2)', border: '1px solid var(--border)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
          <button 
            onClick={handleShareToggle}
            disabled={sharing}
            className={`btn btn-sm ${myShare?.shared ? 'btn-success-soft' : 'btn-ghost'}`}
            style={{ fontSize: '0.75rem', flexGrow: 1 }}
          >
            {myShare?.shared ? '✓ Contact Info Shared' : '🔓 Share My Contact Info'}
          </button>
        </div>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
          <input 
            className="inp" 
            placeholder="Type a message..." 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ borderRadius: '25px', padding: '10px 20px' }}
          />
          <button type="submit" className="btn btn-neon" style={{ borderRadius: '50%', width: '46px', height: '46px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}
