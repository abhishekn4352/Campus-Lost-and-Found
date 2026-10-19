import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, EyeOff, Timer, ArrowRight } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';
import ItemCard from '../components/ItemCard';
import Button from '../components/Button';
import useDocumentTitle from '../hooks/useDocumentTitle';

const STEPS = [
  { title: 'Post it', text: 'Say what you lost or found, where, and when. A photo helps a lot.' },
  { title: 'Match up', text: 'Browse and search the board, or message the person who posted. Phone and email stay hidden until you both agree to share.' },
  { title: 'Hand it over', text: 'A finder reviews each claim, so an item only goes to someone who can describe it. Then you arrange the handover in chat.' },
];

const POINTS = [
  { icon: EyeOff, title: 'Private by default', text: 'Other students only see your name. Your phone and email are shared in a chat only if both of you choose to.' },
  { icon: ShieldCheck, title: 'Claims are reviewed', text: 'To claim a found item you describe what only the owner would know. The finder approves or rejects it.' },
  { icon: Timer, title: 'The board stays current', text: 'Posts close automatically after 30 days, so what you see is what is still waiting to be matched.' },
];

export default function Home() {
  useDocumentTitle();
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([API.get('/items/stats'), API.get('/items?limit=3')]).then(([s, r]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') setStats(s.value.data);
      if (r.status === 'fulfilled') setRecent(r.value.data?.items || []);
    });
    return () => { alive = false; };
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/items?q=${encodeURIComponent(q)}` : '/items');
  };

  // Show real numbers only once there is something real to show.
  const statItems = stats && stats.reunited > 0 ? [
    { num: stats.reunited, lbl: 'Items returned to owners' },
    { num: stats.activeMembers, lbl: 'Verified students' },
    stats.successRate != null && { num: `${stats.successRate}%`, lbl: 'Of posts end in a return' },
    stats.avgResolutionHours != null && { num: `${stats.avgResolutionHours}h`, lbl: 'Average time to return' },
  ].filter(Boolean) : [];

  return (
    <>
      <section className="hero">
        <div className={`container hero-grid ${recent.length ? '' : 'solo'}`}>
          <div>
            <h1>Lost something on campus? Start with what’s been found.</h1>
            <p className="hero-lede">One board for every lost and found item on campus. Search it, post to it, and get things back to their owners.</p>

            <form className="hero-search" onSubmit={submit} role="search">
              <div className="input-icon grow">
                <Search size={20} aria-hidden="true" />
                <input
                  className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Black wallet, ID card, keys…" aria-label="Search lost and found items"
                />
              </div>
              <Button type="submit" variant="primary">Search</Button>
            </form>

            <div className="hero-chips" aria-label="Browse by category">
              {CATEGORIES.slice(0, 6).map((c) => {
                const Icon = CATEGORY_ICONS[c];
                return (
                  <Link key={c} to={`/items?category=${encodeURIComponent(c)}`} className="chip">
                    <Icon size={15} aria-hidden="true" />{c}
                  </Link>
                );
              })}
            </div>

            <div className="hero-actions">
              <Button to={isLoggedIn() ? '/post-item' : '/register'} size="lg">
                {isLoggedIn() ? 'Report an item' : 'Create a free account'}
              </Button>
              <Button to="/items" variant="ghost" size="lg">Browse all items<ArrowRight size={18} aria-hidden="true" /></Button>
            </div>
          </div>

          {recent.length > 0 && (
            <div className="board" aria-label="Recently posted items">
              {recent.map((item) => <ItemCard key={item._id} item={item} compact />)}
            </div>
          )}
        </div>
      </section>

      {statItems.length > 0 && (
        <section className="section section-alt" aria-label="Campus results">
          <div className="container stats">
            {statItems.map((s) => (
              <div key={s.lbl}><div className="num">{s.num}</div><div className="lbl">{s.lbl}</div></div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three steps from “I lost it” to “I’ve got it back”.</p>
          </div>
          <ol className="steps" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {STEPS.map((s) => (
              <li className="step" key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head"><h2>Built so it’s safe to use</h2></div>
          <div className="points">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div className="point" key={title}>
                <span className="pt-icon"><Icon size={22} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta">
            <h2>Missing something right now?</h2>
            <p>Posting takes about a minute. The sooner it’s on the board, the sooner someone can spot it.</p>
            <div className="row row-wrap" style={{ justifyContent: 'center' }}>
              <Button to={isLoggedIn() ? '/post-item' : '/register'} variant="primary" size="lg">
                {isLoggedIn() ? 'Report a lost item' : 'Get started'}
              </Button>
              <Button to="/items" size="lg" variant="secondary">Browse found items</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
