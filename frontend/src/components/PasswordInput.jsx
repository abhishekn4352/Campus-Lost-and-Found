import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Rough strength meter: length plus character variety. Guidance only — the
// server enforces the real minimum.
export function passwordStrength(pw = '') {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, Math.min(4, score));
}

export default function PasswordInput({ label, name, value, onChange, placeholder, autoComplete, required = true, showStrength = false, hint, error }) {
  const [visible, setVisible] = useState(false);
  const level = showStrength ? passwordStrength(value) : 0;
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      {label && <label className="label" htmlFor={name}>{label}</label>}
      <div className="input-icon has-action">
        <input
          id={name}
          type={visible ? 'text' : 'password'}
          className="input"
          style={{ paddingLeft: 14 }}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="icon-btn input-action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="strength" data-level={level} aria-hidden="true"><i /><i /><i /><i /></div>
      )}
      {hint && <span id={`${name}-hint`} className="hint">{hint}</span>}
      {error && <span id={`${name}-error`} className="error-text">{error}</span>}
    </div>
  );
}
