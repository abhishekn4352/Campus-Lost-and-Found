import { Link } from 'react-router-dom';

// variant: primary | secondary | ghost | danger | success   size: sm | lg
// Pass `to` to render a router link styled as a button.
export default function Button({
  to, variant = 'secondary', size, block, loading = false, icon: Icon,
  className = '', children, disabled, type = 'button', ...rest
}) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : Icon ? <Icon size={18} aria-hidden="true" /> : null}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
