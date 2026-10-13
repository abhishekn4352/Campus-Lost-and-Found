import { useState } from 'react';

export default function PasswordInput({ label, name, value, onChange, placeholder, autoComplete, required = true }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={name}>{label}</label>}
      <div className="inp-wrap">
        <input
          id={name}
          type={visible ? 'text' : 'password'}
          className="inp"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
          className="inp-toggle-btn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}
