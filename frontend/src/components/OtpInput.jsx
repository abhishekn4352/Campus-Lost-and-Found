import { useRef } from 'react';

// Six single-digit boxes with auto-advance, backspace-to-previous and paste
// support. `value` is the full string; `onChange` receives the new string.
export default function OtpInput({ value, onChange, length = 6, disabled, label = 'Verification code', autoFocus }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const set = (next) => onChange(next.replace(/\D/g, '').slice(0, length));

  const handleChange = (i, e) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (!typed) return;
    const chars = digits.slice();
    // Browsers' autofill / multi-char input arrives as one string.
    typed.split('').forEach((d, k) => { if (i + k < length) chars[i + k] = d; });
    set(chars.join(''));
    refs.current[Math.min(i + typed.length, length - 1)]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const chars = digits.slice();
      if (chars[i]) chars[i] = '';
      else if (i > 0) { chars[i - 1] = ''; refs.current[i - 1]?.focus(); }
      set(chars.join(''));
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    set(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="otp" role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="input"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
