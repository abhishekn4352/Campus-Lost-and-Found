const LABELS = {
  lost: 'Lost', found: 'Found',
  Open: 'Open', Claimed: 'Claimed', Closed: 'Closed',
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Withdrawn',
};

export function Badge({ kind, children, className = '' }) {
  return <span className={`badge badge-${String(kind).toLowerCase()} ${className}`}>{children ?? LABELS[kind] ?? kind}</span>;
}

export const TypeBadge = ({ type }) => <Badge kind={type} />;
// Item statuses (Open/Claimed/Closed) and claim statuses share one look.
export const StatusBadge = ({ status }) => <Badge kind={status} />;
