import { Link } from 'react-router-dom';
import { SITE_NAME } from '../constants';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        <span className="row row-wrap" style={{ gap: 20 }}>
          <Link to="/items">Browse items</Link>
          <Link to="/post-item">Report an item</Link>
        </span>
      </div>
    </footer>
  );
}
