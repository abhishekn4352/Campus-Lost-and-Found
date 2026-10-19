import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog: focus moves in, Tab stays inside, Escape and a click
// on the backdrop close it, and focus returns to what opened it.
export default function Modal({ title, onClose, children, role = 'dialog' }) {
  const ref = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const node = ref.current;
    const focusables = () => Array.from(node.querySelectorAll(FOCUSABLE));
    (node.querySelector('[data-autofocus]') || focusables()[0] || node).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" role={role} aria-modal="true" aria-labelledby={titleId.current} ref={ref} tabIndex={-1}>
        <h2 id={titleId.current}>{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}
