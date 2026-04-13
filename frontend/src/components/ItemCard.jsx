import { Link } from 'react-router-dom';

const CATEGORY_ICONS = {
  Electronics: '💻',
  Books: '📚',
  'ID Card': '🪪',
  Keys: '🔑',
  Wallet: '👛',
  Clothing: '👕',
  Sports: '⚽',
  Other: '📦',
};

export default function ItemCard({ item }) {
  const icon = CATEGORY_ICONS[item.category] || '📦';
  const imgSrc = item.imageUrl
    ? `${import.meta.env.VITE_API_URL.replace('/api', '')}${item.imageUrl}`
    : null;

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  return (
    <Link to={`/items/${item._id}`} className="item-card" style={{ textDecoration: 'none' }}>
      <div className="item-img-wrap">
        {imgSrc ? (
          <img src={imgSrc} alt={item.title} loading="lazy" />
        ) : (
          <div className="item-img-placeholder">{icon}</div>
        )}
        <span className={`item-type-badge ${item.type === 'lost' ? 'badge-lost-pill' : 'badge-found-pill'}`}>
          {item.type === 'lost' ? '● Lost' : '● Found'}
        </span>
      </div>

      <div className="item-card-body">
        <h3 className="item-card-title">{item.title}</h3>
        <p className="item-card-desc">{item.description}</p>

        <div className="item-meta">
          <div className="item-meta-row">
            <span>📍</span>
            <span>{item.location}</span>
          </div>
          <div className="item-meta-row">
            <span>🏷️</span>
            <span>{item.category}</span>
          </div>
          <div className="item-meta-row">
            <span>🕐</span>
            <span>{timeAgo(item.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="item-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`badge-pill ${item.type === 'lost' ? 'badge-lost' : 'badge-found'}`}>
          {item.type}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--neon)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
          View Details →
        </span>
      </div>
    </Link>
  );
}
