import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MessageCircle, Inbox, ChevronRight, HandHelping } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { getErrorMessage } from '../utils/errorMessage';
import { plural } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import ItemCard from '../components/ItemCard';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import { CardSkeletonGrid, ErrorState } from '../components/States';

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { unreadMessages, claimsToReview, myPendingClaims } = useNotifications();
  const [posts, setPosts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [postsRes, recentRes] = await Promise.all([API.get('/items/my-posts'), API.get('/items?limit=4')]);
      setPosts(postsRes.data);
      setRecent(recentRes.data?.items || []);
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = posts.filter((p) => p.status === 'Open').length;
  const waiting = posts.filter((p) => p.status === 'Claimed').length;
  const returned = posts.filter((p) => p.status === 'Closed' && !p.autoClosed).length;
  const firstName = user?.name?.split(' ')[0] || 'there';

  const attention = [
    claimsToReview > 0 && { to: '/claims?tab=received', icon: Inbox, text: `${plural(claimsToReview, 'claim')} on your items ${claimsToReview === 1 ? 'needs' : 'need'} a decision` },
    unreadMessages > 0 && { to: '/messages', icon: MessageCircle, text: `${plural(unreadMessages, 'unread message')}` },
    myPendingClaims > 0 && { to: '/claims', icon: HandHelping, text: `${plural(myPendingClaims, 'claim')} you sent ${myPendingClaims === 1 ? 'is' : 'are'} waiting for a reply` },
  ].filter(Boolean);

  return (
    <div className="container page">
      <PageHeader title={`Hi, ${firstName}`} subtitle="Here’s what needs your attention.">
        <Button to="/post-item" variant="primary" icon={Plus}>Report an item</Button>
      </PageHeader>

      {attention.length > 0 && (
        <div className="attention">
          {attention.map(({ to, icon: Icon, text }) => (
            <Link key={to} to={to}><Icon size={20} aria-hidden="true" /><span>{text}</span><ChevronRight size={18} aria-hidden="true" /></Link>
          ))}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <div className="tiles">
            <div className="tile"><div className="num">{loading ? '–' : open}</div><div className="lbl">Your open posts</div></div>
            <div className="tile"><div className="num">{loading ? '–' : waiting}</div><div className="lbl">Matched, awaiting handover</div></div>
            <div className="tile"><div className="num">{loading ? '–' : returned}</div><div className="lbl">Returned</div></div>
          </div>

          <div className="page-header" style={{ marginBottom: 16 }}>
            <h2>Latest on campus</h2>
            <Link to="/items">See all items</Link>
          </div>
          {loading ? <CardSkeletonGrid count={4} /> : recent.length === 0 ? (
            <p className="muted">Nothing has been posted yet.</p>
          ) : (
            <div className="grid-cards">{recent.map((item) => <ItemCard key={item._id} item={item} />)}</div>
          )}
        </>
      )}
    </div>
  );
}
