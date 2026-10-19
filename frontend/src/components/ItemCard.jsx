import { Link } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import { CATEGORY_ICONS } from '../constants';
import { assetUrl } from '../utils/assets';
import { timeAgo } from '../utils/format';
import { TypeBadge } from './Badge';

export function ItemMedia({ item, className, size = 44 }) {
  const Icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.Other;
  const src = assetUrl(item.imageUrl);
  return (
    <div className={`${className} is-${item.type}`}>
      {src ? <img src={src} alt={item.title} loading="lazy" /> : <Icon size={size} strokeWidth={1.6} aria-label={item.category} role="img" />}
    </div>
  );
}

// A claim-ticket: punched hole, image, tear-off stub with where/when.
export default function ItemCard({ item, compact = false }) {
  return (
    <Link to={`/items/${item._id}`} className={`ticket ${compact ? 'ticket-compact' : ''}`}>
      <div style={{ position: 'relative' }}>
        <ItemMedia item={item} className="ticket-media" />
        <div className="ticket-type"><TypeBadge type={item.type} /></div>
      </div>
      <div className="ticket-body">
        <h3 className="ticket-title">{item.title}</h3>
        {!compact && <p className="ticket-desc">{item.description}</p>}
      </div>
      <div className="ticket-tear" aria-hidden="true" />
      <div className="ticket-foot">
        <span><MapPin size={15} aria-hidden="true" /><span className="truncate">{item.location}</span></span>
        <span><Clock size={15} aria-hidden="true" />{timeAgo(item.createdAt)}</span>
      </div>
    </Link>
  );
}
