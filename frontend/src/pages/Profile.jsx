import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';
import PasswordInput from '../components/PasswordInput';
import Spinner from '../components/Spinner';
import API from '../api/axios';

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

export default function Profile() {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Activity summary — reuses existing endpoints rather than adding a new
  // backend aggregation just for this page.
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (user) setForm({ name: user.name || '', phone: user.phone || '' });
  }, [user]);

  useEffect(() => {
    Promise.all([API.get('/items/my-posts'), API.get('/claims/my-claims')])
      .then(([postsRes, claimsRes]) => {
        const posts = postsRes.data;
        setSummary({
          totalPosts: posts.length,
          openPosts: posts.filter(i => i.status === 'Open').length,
          resolvedPosts: posts.filter(i => i.status === 'Closed').length,
          totalClaims: claimsRes.data.length,
        });
      })
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name) return setError('Name cannot be empty.');
    if (!PHONE_RE.test(phone)) return setError('Please enter a valid phone number.');

    setSaving(true);
    setError('');
    try {
      const { data } = await API.put('/auth/profile', { name, phone });
      login(data); // refresh the shared user object (Navbar initials, etc.)
      showToast('Profile updated.', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <Spinner text="Loading your profile..." />;

  return (
    <div className="page-wrap" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="pg-header">
        <div className="pg-kicker">Account</div>
        <h1 className="pg-title">Your Profile</h1>
        <p className="pg-sub">Manage your account details and see your activity at a glance</p>
      </div>

      {/* Activity summary — connects Profile to the rest of the workflow
          instead of being an isolated settings page. */}
      <div className="card-panel" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: 16, color: 'var(--text-2)' }}>Your Activity</h3>
        {summaryLoading ? (
          <Spinner text="Loading activity..." />
        ) : summary ? (
          <div className="row g-3 text-center">
            <div className="col-6 col-md-3">
              <div className="stat-num" style={{ fontSize: '1.6rem' }}>{summary.totalPosts}</div>
              <div className="stat-lbl" style={{ fontSize: '0.7rem' }}>Total Posts</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-num" style={{ fontSize: '1.6rem' }}>{summary.openPosts}</div>
              <div className="stat-lbl" style={{ fontSize: '0.7rem' }}>Still Open</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-num" style={{ fontSize: '1.6rem' }}>{summary.resolvedPosts}</div>
              <div className="stat-lbl" style={{ fontSize: '0.7rem' }}>Resolved</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stat-num" style={{ fontSize: '1.6rem' }}>{summary.totalClaims}</div>
              <div className="stat-lbl" style={{ fontSize: '0.7rem' }}>Claims Made</div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>Couldn't load your activity right now.</p>
        )}
      </div>

      <div className="card-panel">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 16, color: 'var(--text-2)' }}>Account Details</h3>

        {error && <div className="alert-box alert-err" role="alert">⚠️ {error}</div>}

        <form onSubmit={handleSave} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="profile-name">Full Name</label>
            <input id="profile-name" className="inp" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="profile-phone">Phone Number</label>
            <input id="profile-phone" type="tel" className="inp" name="phone" value={form.phone} onChange={handleChange} required />
          </div>

          {/* Read-only fields: email and College ID are tied to
              verification/identity and aren't editable from here. */}
          <div className="field">
            <label className="field-label">Email Address</label>
            <input className="inp" value={user.email} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <div className="field">
            <label className="field-label">College ID</label>
            <input className="inp" value={user.collegeId} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>

          <button type="submit" className="btn btn-neon btn-full btn-lg" disabled={saving} aria-busy={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
