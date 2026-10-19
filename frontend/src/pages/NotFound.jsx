import { SearchX } from 'lucide-react';
import { EmptyState } from '../components/States';
import Button from '../components/Button';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="container container-narrow page">
      <EmptyState icon={SearchX} title="We can’t find that page" action={<Button to="/items" variant="primary">Browse items</Button>}>
        The link may be old or mistyped. Try searching the items instead.
      </EmptyState>
    </div>
  );
}
