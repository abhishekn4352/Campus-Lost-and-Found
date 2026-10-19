import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, PackageSearch } from 'lucide-react';
import API from '../api/axios';
import { CATEGORIES, PAGE_SIZE } from '../constants';
import { getErrorMessage } from '../utils/errorMessage';
import { plural } from '../utils/format';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useDocumentTitle from '../hooks/useDocumentTitle';
import ItemCard from '../components/ItemCard';
import Button from '../components/Button';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import { CardSkeletonGrid, EmptyState, ErrorState } from '../components/States';

const TYPES = [
  { value: '', label: 'All' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
];

export default function ItemList() {
  useDocumentTitle('Browse items');
  // The URL is the source of truth for filters, so any view can be shared,
  // bookmarked, and survives refresh / the back button.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebouncedValue(search, 400);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Only the most recently started request may update the screen, so a slow
  // earlier response can never overwrite a newer one.
  const latest = useRef(0);

  const update = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Typing -> URL (debounced).
  useEffect(() => { if (debouncedSearch.trim() !== q) update({ q: debouncedSearch.trim() }); }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  // URL -> input (e.g. arriving from the home page search, or "clear").
  useEffect(() => { setSearch(q); }, [q]);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError('');
    try {
      const { data: res } = await API.get('/items', {
        params: { q: q || undefined, type: type || undefined, category: category || undefined, sort: sort === 'oldest' ? 'oldest' : undefined, page, limit: PAGE_SIZE },
      });
      if (id === latest.current) setData({ items: res.items || [], total: res.total ?? 0, pages: res.pages || 1 });
    } catch (err) {
      if (id === latest.current) setError(getErrorMessage(err, 'We couldn’t load items right now.'));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [q, type, category, sort, page]);

  useEffect(() => { load(); }, [load]);

  const hasFilters = q || type || category || sort === 'oldest';
  const clearAll = () => { setSearch(''); setParams({}, { replace: true }); };
  const goToPage = (p) => { update({ page: p > 1 ? String(p) : '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="container page">
      <PageHeader title="Browse items" subtitle="Everything currently lost or found on campus." />

      <form className="filters" role="search" aria-label="Filter items" onSubmit={(e) => e.preventDefault()}>
        <div className="filters-grid">
          <div className="field">
            <label className="label" htmlFor="filter-q">Search</label>
            <div className="input-icon has-action">
              <Search size={18} aria-hidden="true" />
              <input id="filter-q" className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Wallet, keys, library…" />
              {search && (
                <button type="button" className="icon-btn input-action" onClick={() => { setSearch(''); update({ q: '' }); }} aria-label="Clear search">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="field">
            <span className="label" id="type-label">Type</span>
            <div className="seg" role="group" aria-labelledby="type-label">
              {TYPES.map((t) => (
                <button key={t.value} type="button" className={t.value ? `is-${t.value}` : ''} aria-pressed={type === t.value} onClick={() => update({ type: t.value })}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="filter-category">Category</label>
            <select id="filter-category" className="select" value={category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="filter-sort">Sort</label>
            <select id="filter-sort" className="select" value={sort} onChange={(e) => update({ sort: e.target.value === 'oldest' ? 'oldest' : '' })}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      </form>

      <div className="results-bar" aria-live="polite">
        <span>{loading ? 'Searching…' : error ? '' : plural(data.total, 'item') + (q ? ` for “${q}”` : '')}</span>
        {hasFilters && <Button variant="ghost" size="sm" icon={X} onClick={clearAll}>Clear filters</Button>}
      </div>

      {loading ? (
        <CardSkeletonGrid count={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={hasFilters ? 'Nothing matches those filters' : 'Nothing has been posted yet'}
          action={hasFilters ? <Button onClick={clearAll}>Clear filters</Button> : <Button to="/post-item" variant="primary">Report the first item</Button>}
        >
          {hasFilters ? 'Try a shorter search, a different category, or remove a filter.' : 'Lost or found something? Be the first to put it on the board.'}
        </EmptyState>
      ) : (
        <>
          <div className="grid-cards">
            {data.items.map((item) => <ItemCard key={item._id} item={item} />)}
          </div>
          <Pagination page={page} pages={data.pages} onChange={goToPage} />
        </>
      )}
    </div>
  );
}
