import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorMessage';
import useCooldown from '../hooks/useCooldown';
import useDocumentTitle from '../hooks/useDocumentTitle';
import PasswordInput from '../components/PasswordInput';
import OtpInput from '../components/OtpInput';
import Button from '../components/Button';
import { Alert } from '../components/States';
import API from '../api/axios';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const MIN_PASSWORD = 8;

export default function Register() {
  useDocumentTitle('Create account');
  const [step, setStep] = useState(1); // 1: email, 2: code + details
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', collegeId: '', otp: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, startCooldown] = useCooldown(30);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const field = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const requestOtp = async () => {
    const email = form.email.trim();
    if (!email) { setError('Enter your email address.'); return false; }
    if (!EMAIL_RE.test(email)) { setError('Enter a valid email address.'); return false; }
    setLoading(true); setError('');
    try {
      await API.post('/auth/request-otp', { email, purpose: 'register' });
      setForm((f) => ({ ...f, email, otp: '' }));
      setInfo(`We sent a 6-digit code to ${email}.`);
      startCooldown();
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t send the code.'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailStep = async (e) => {
    e.preventDefault();
    if (await requestOtp()) setStep(2);
  };

  const validate = () => {
    if (form.otp.length !== 6) return 'Enter the full 6-digit code.';
    if (!form.name.trim()) return 'Enter your full name.';
    if (form.password.length < MIN_PASSWORD) return `Choose a password of at least ${MIN_PASSWORD} characters.`;
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    if (!PHONE_RE.test(form.phone.trim())) return 'Enter a valid phone number.';
    if (!form.collegeId.trim()) return 'Enter your college ID.';
    return null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    setLoading(true); setError('');
    try {
      const { data } = await API.post('/auth/register-verify', {
        name: form.name.trim(), email: form.email.trim(), password: form.password,
        phone: form.phone.trim(), collegeId: form.collegeId.trim(), otp: form.otp,
      });
      login(data.user);
      showToast(`Welcome, ${data.user.name.split(' ')[0]}!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t create your account.'));
      setLoading(false);
    }
  };

  const mismatch = form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <div className="auth">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1>{step === 1 ? 'Create your account' : 'Finish setting up'}</h1>
        <p className="page-sub">{step === 1 ? 'Verify your email to get started. It takes a minute.' : 'Enter the code we emailed you, then your details.'}</p>

        {error && <Alert type="error">{error}</Alert>}
        {info && step === 2 && <Alert type="success">{info}</Alert>}

        {step === 1 ? (
          <form onSubmit={handleEmailStep} noValidate>
            <div className="field">
              <label className="label" htmlFor="reg-email">Email address</label>
              <div className="input-icon">
                <Mail size={18} aria-hidden="true" />
                <input id="reg-email" type="email" className="input" value={form.email} onChange={field('email')} placeholder="you@college.edu" autoComplete="email" required />
              </div>
              <span className="hint">Use the email you check most. We’ll send a code to confirm it.</span>
            </div>
            <Button type="submit" variant="primary" size="lg" block loading={loading}>Send verification code</Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} noValidate>
            <div className="field">
              <span className="label" style={{ textAlign: 'center' }}>Verification code</span>
              <OtpInput value={form.otp} onChange={(otp) => setForm((f) => ({ ...f, otp }))} autoFocus />
              <p className="hint" style={{ textAlign: 'center' }}>
                {cooldown > 0 ? `Request a new code in ${cooldown}s.` : (
                  <>Didn’t get it? <button type="button" className="link-btn" onClick={() => { setInfo(''); requestOtp().then((ok) => ok && setInfo(`We sent a new code to ${form.email}.`)); }} disabled={loading}>Send a new code</button></>
                )}
              </p>
            </div>

            <div className="divider">Your details</div>

            <div className="field">
              <label className="label" htmlFor="reg-name">Full name</label>
              <input id="reg-name" className="input" value={form.name} onChange={field('name')} placeholder="Riya Sharma" autoComplete="name" maxLength={80} required />
            </div>

            <PasswordInput label="Password" name="password" value={form.password} onChange={field('password')} placeholder={`At least ${MIN_PASSWORD} characters`} autoComplete="new-password" showStrength />
            <PasswordInput label="Confirm password" name="confirmPassword" value={form.confirmPassword} onChange={field('confirmPassword')} placeholder="Re-enter your password" autoComplete="new-password" error={mismatch ? 'Passwords do not match.' : undefined} />

            <div className="field">
              <label className="label" htmlFor="reg-phone">Phone number</label>
              <input id="reg-phone" type="tel" className="input" value={form.phone} onChange={field('phone')} placeholder="98765 43210" autoComplete="tel" required />
              <span className="hint">Never shown to others unless you choose to share it in a chat.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="reg-collegeid">College ID</label>
              <input id="reg-collegeid" className="input" value={form.collegeId} onChange={field('collegeId')} placeholder="Your student ID" maxLength={40} required />
            </div>

            <Button type="submit" variant="primary" size="lg" block loading={loading}>Create account</Button>
            <Button variant="ghost" block className="mt-2" onClick={() => { setStep(1); setError(''); setInfo(''); }} disabled={loading}>Use a different email</Button>
          </form>
        )}

        <p className="auth-foot">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
