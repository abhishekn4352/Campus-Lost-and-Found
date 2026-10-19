import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
      <span className="page-info" aria-live="polite">Page {page} of {pages}</span>
      <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next<ChevronRight size={18} aria-hidden="true" />
      </Button>
    </nav>
  );
}
