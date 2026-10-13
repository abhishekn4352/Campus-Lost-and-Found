import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const features = [
  {
    icon: '🔒',
    title: 'OTP-Verified Claims',
    desc: 'Every claim is verified via college email OTP. Nobody can take your item without proving ownership.'
  },
  {
    icon: '⚡',
    title: 'Real-Time Dashboard',
    desc: 'Track your posts and claims live. See status updates the moment something changes.'
  },
  {
    icon: '🔍',
    title: 'Smart Search & Filters',
    desc: 'Filter by category, type, and location. Find exactly what you\'re looking for, fast.'
  },
  {
    icon: '📸',
    title: 'Photo Evidence',
    desc: 'Attach images to your reports. Visual proof makes matches and claims more reliable.'
  },
  {
    icon: '🛡️',
    title: 'Admin Oversight',
    desc: 'Campus admins manage all items and claims, ensuring every case is handled properly.'
  },
  {
    icon: '📱',
    title: 'Fully Responsive',
    desc: 'Works perfectly on mobile, tablet, and desktop. Report items on-the-go from anywhere.'
  },
];

export default function Home() {
  const { isLoggedIn } = useAuth();

  // Real numbers from the database — previously this was a hardcoded,
  // fake "1.2K+ Items Reunited" style row that never changed. When the
  // sample size is too small to be meaningful (e.g. a brand-new campus
  // deployment), the backend returns null rather than a misleading
  // number, and this shows an honest "just getting started" placeholder
  // instead of fabricating a rate.
  const [stats, setStats] = useState(null);

  useEffect(() => {
    API.get('/items/stats')
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null)); // homepage still works fine without this strip
  }, []);

  const statDisplay = [
    { num: stats ? `${stats.reunited}${stats.reunited >= 100 ? '+' : ''}` : '—', lbl: 'Items Reunited' },
    { num: stats ? `${stats.activeMembers}${stats.activeMembers >= 100 ? '+' : ''}` : '—', lbl: 'Active Members' },
    { num: stats?.successRate != null ? `${stats.successRate}%` : 'New', lbl: 'Success Rate' },
    { num: stats?.avgResolutionHours != null ? `${stats.avgResolutionHours}h` : '—', lbl: 'Avg. Match Time' },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="anim-up">
            <div className="hero-tag">
              <div className="hero-tag-dot" />
              Trusted by 5000+ Students
            </div>
            <h1 className="hero-title">
              Lost it?<br />
              <span className="hero-title-accent">Found.</span> Reunited.
            </h1>
            <p className="hero-subtitle">
              The most advanced campus lost &amp; found portal. Secure, fast, and
              verified through official channels.
            </p>
            <div className="hero-ctas">
              <Link to="/items" className="btn btn-neon btn-lg">
                Browse Items →
              </Link>
              {!isLoggedIn() && (
                <Link to="/register" className="btn btn-ghost btn-lg">
                  Join for Free
                </Link>
              )}
              {isLoggedIn() && (
                <Link to="/post-item" className="btn btn-violet btn-lg">
                  + Report Item
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <div className="stats-strip">
        <div className="container">
          <div className="row text-center">
            {statDisplay.map((s, i) => (
              <div className="col-6 col-md-3" key={i}>
                <div className={`stat-item anim-up delay-${i + 1}`}>
                  <div className="stat-num">{s.num}</div>
                  <div className="stat-lbl">{s.lbl}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section style={{ padding: '72px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div className="pg-kicker">Why Choose Us</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, letterSpacing: '-0.03em', margin: '6px 0 12px' }}>
              Built for campus life
            </h2>
            <p style={{ color: 'var(--text-3)', maxWidth: '480px', margin: '0 auto', fontSize: '0.95rem', fontWeight: 300 }}>
              Every feature is designed with students in mind — simple, secure, and effective.
            </p>
          </div>

          <div className="row g-3">
            {features.map((f, i) => (
              <div className="col-md-6 col-lg-4" key={i}>
                <div className={`feature-card anim-up delay-${(i % 5) + 1}`}>
                  <div className="feature-icon">{f.icon}</div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section style={{ padding: '48px 0 80px' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,229,255,0.07) 0%, rgba(124,58,237,0.1) 100%)',
            border: '1px solid var(--border-active)',
            borderRadius: '20px',
            padding: '52px 40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)', width: '400px', height: '200px', background: 'radial-gradient(ellipse, rgba(0,229,255,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '12px' }}>
              Missing something?
            </h2>
            <p style={{ color: 'var(--text-3)', marginBottom: '28px', maxWidth: '400px', margin: '0 auto 28px', fontWeight: 300 }}>
              Post a report in under 2 minutes and let 5000+ students help you find it.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {isLoggedIn() ? (
                <>
                  <Link to="/post-item" className="btn btn-neon btn-lg">Report Lost Item</Link>
                  <Link to="/items" className="btn btn-ghost btn-lg">Browse Found Items</Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn btn-neon btn-lg">Get Started Free</Link>
                  <Link to="/items" className="btn btn-ghost btn-lg">Browse Items</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer>
        <p>© 2026 Campus L&amp;F Portal — Built for the future of student communities</p>
      </footer>
    </div>
  );
}
