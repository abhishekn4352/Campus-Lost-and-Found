import { useState } from 'react';
import { Mail } from 'lucide-react';
import API from '../api/axios';
import { getErrorMessage } from '../utils/errorMessage';
import useCooldown from '../hooks/useCooldown';
import Modal from './Modal';
import Button from './Button';
import OtpInput from './OtpInput';
import PasswordInput from './PasswordInput';
import { Alert } from './States';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Two steps, so a stolen session can't quietly re-point the account:
//  1. new address + current password  -> a code is mailed to the NEW address
//  2. type that code                  -> the address is swapped
export default function ChangeEmailDialog({ currentEmail, onClose, onChanged }) {
  const [step, setStep] = useState(1);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, startCooldown] = useCooldown(30);

  const sendCode = async () => {
    const email = newEmail.trim();
    if (!EMAIL_RE.test(email)) return setError('Enter a valid email address.');
    if (email.toLowerCase() === currentEmail.toLowerCase()) return setError('That is already your email address.');
    if (!password) return setError('Enter your current password to confirm it is you.');
    setBusy(true); setError('');
    try {
      await API.post('/auth/email/request', { newEmail: email, password });
      setNewEmail(email);
      setStep(2);
      startCooldown();
    } catch (err) {
      setError(getErrorMessage(err, 'We couldn’t send the code.'));
    } finally { setBusy(false); }
  };

  const confirm = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return setError('Enter the full 6-digit code.');
    setBusy(true); setError('');
    try {
      const { data } = await API.post('/auth/email/confirm', { otp });
      onChanged(data.user);
    } catch (err) {
      setError(getErrorMessage(err, 'That code didn’t work.'));
      setBusy(false);
    }
  };

  return (
    <Modal title="Change email address" onClose={onClose}>
      {error && <Alert type="error">{error}</Alert>}

      {step === 1 ? (
        <form onSubmit={(e) => { e.preventDefault(); sendCode(); }} noValidate>
          <p className="muted" style={{ marginBottom: 16 }}>Your current address is <strong>{currentEmail}</strong>. We’ll send a code to the new one to make sure it’s yours.</p>
          <div className="field">
            <label className="label" htmlFor="new-email">New email address</label>
            <div className="input-icon">
              <Mail size={18} aria-hidden="true" />
              <input id="new-email" type="email" className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" data-autofocus />
            </div>
          </div>
          <PasswordInput label="Current password" name="email-change-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <div className="modal-actions">
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" loading={busy}>Send code</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirm} noValidate>
          <p className="muted" style={{ marginBottom: 16 }}>We sent a 6-digit code to <strong>{newEmail}</strong>. It expires in 10 minutes.</p>
          <div className="field"><OtpInput value={otp} onChange={setOtp} autoFocus label="Email change code" /></div>
          <p className="hint" style={{ textAlign: 'center' }}>
            {cooldown > 0 ? `You can request another code in ${cooldown}s.` : (
              <>Didn’t get it? <button type="button" className="link-btn" disabled={busy} onClick={sendCode}>Send a new code</button></>
            )}
          </p>
          <div className="modal-actions">
            <Button onClick={() => { setStep(1); setOtp(''); setError(''); }} disabled={busy}>Back</Button>
            <Button type="submit" variant="primary" loading={busy} disabled={otp.length !== 6}>Confirm new email</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
