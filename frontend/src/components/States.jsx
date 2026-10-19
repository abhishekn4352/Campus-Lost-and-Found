import { AlertTriangle, CheckCircle2, Info, RotateCcw } from 'lucide-react';
import Button from './Button';

export function PageLoader({ text = 'Loading…' }) {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={40} aria-hidden="true" />}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong while loading this.', onRetry }) {
  return (
    <div className="empty" role="alert">
      <AlertTriangle size={40} aria-hidden="true" />
      <h2>Couldn’t load this</h2>
      <p>{message}</p>
      {onRetry && <Button icon={RotateCcw} onClick={onRetry}>Try again</Button>}
    </div>
  );
}

const ALERT_ICONS = { error: AlertTriangle, success: CheckCircle2, info: Info, warning: AlertTriangle };

export function Alert({ type = 'info', children, className = '', ...rest }) {
  const Icon = ALERT_ICONS[type];
  return (
    <div className={`alert alert-${type} ${className}`} role={type === 'error' ? 'alert' : 'status'} {...rest}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }) {
  return (
    <div className="grid-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card" key={i}>
          <div className="skeleton" style={{ aspectRatio: '4 / 3' }} />
          <div className="skeleton sk-line" style={{ width: '70%' }} />
          <div className="skeleton sk-line" style={{ width: '90%' }} />
          <div className="skeleton sk-line" style={{ width: '45%' }} />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <div className="skeleton" key={i} style={{ height: 88, borderRadius: 12 }} />)}
    </div>
  );
}
