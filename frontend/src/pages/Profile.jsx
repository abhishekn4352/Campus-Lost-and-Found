import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../utils/errorMessage';
import { initials } from '../utils/format';
import useDocumentTitle from '../hooks/useDocumentTitle';
import PasswordInput from '../components/PasswordInput';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import { Alert, PageLoader } from '../components/States';
import API from '../api/axios';

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const MIN_PASSWORD = 8;

export default function Profile() {
  useDocumentTitle('Profile');
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => { if (user) setForm({ name: user.name || '', phone: user.phone || '' }); }, [user]);

  if (!user) return <div className="container page"><PageLoader text="Loading your profile…" /></div>;

  const dirty = form.name.trim() !== user.name || form.phone.trim() !== user.phone;

  const saveProfile = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name) return setError('Name cannot be empty.');
    if (!PHONE_RE.test(phone)) return setError('Enter a valid phone number.');
    setSaving(true); setError('');
    try {
      const { data } = await API.put('/auth/profile', { name, phone });
      login(data); // refresh the shared user object (navbar initials etc.)
      showToast('Profile updated.', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!pw.currentPassword) return setPwError('Enter your current password.');
    if (pw.newPassword.length < MIN_PASSWORD) return setPwError(`The new password needs at least ${MIN_PASSWORD} characters.`);
    setPwSaving(true); setPwError('');
    try {
      await API.put('/auth/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      showToast('Password changed.', 'success');
    } catch (err) {
      setPwError(getErrorMessage(err, 'We couldn’t change your password.'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="container container-form page">
      <PageHeader title="Your profile" />

      <section className="panel" aria-labelledby="acct-h">
        <div className="row" style={{ marginBottom: 20 }}>
          <span className="avatar" style={{ width: 52, height: 52, fontSize: '1.1rem' }} aria-hidden="true">{initials(user.name)}</span>
          <div className="grow"><h2 id="acct-h" style={{ fontSize: '1.2rem' }}>Account details</h2><p className="muted truncate">{user.email}</p></div>
        </div>
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={saveProfile} noValidate>
          <div className="field">
            <label className="label" htmlFor="profile-name">Full name</label>
            <input id="profile-name" className="input" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="profile-phone">Phone number</label>
            <input id="profile-phone" type="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            <span className="hint">Only shared with someone if you both choose to share contact details in a chat.</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="profile-email">Email</label>
            <input id="profile-email" className="input" value={user.email} disabled />
          </div>
          <div className="field">
            <label className="label" htmlFor="profile-college">College ID</label>
            <input id="profile-college" className="input" value={user.collegeId || ''} disabled />
          </div>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>Save changes</Button>
        </form>
      </section>

      <section className="panel" aria-labelledby="pw-h">
        <h2 id="pw-h" style={{ fontSize: '1.2rem' }}>Change password</h2>
        {pwError && <Alert type="error">{pwError}</Alert>}
        <form onSubmit={changePassword} noValidate>
          <PasswordInput label="Current password" name="currentPassword" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />
          <PasswordInput label="New password" name="newPassword" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" showStrength hint={`At least ${MIN_PASSWORD} characters.`} />
          <Button type="submit" loading={pwSaving}>Update password</Button>
        </form>
      </section>

      <section className="panel" aria-labelledby="theme-h">
        <div className="row spread row-wrap">
          <div><h2 id="theme-h" style={{ fontSize: '1.2rem' }}>Appearance</h2><p className="muted">Currently using the {theme} theme.</p></div>
          <Button onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'}</Button>
        </div>
      </section>
    </div>
  );
}
