import { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import ItemCard from '../components/ItemCard';
import Spinner from '../components/Spinner';

const CATEGORIES = ['Electronics', 'Books', 'ID Card', 'Keys', 'Wallet', 'Clothing', 'Sports', 'Other'];
const SEARCH_DEBOUNCE_MS = 400;

export default function ItemList() {
  const [items, setItems]     = useState([]);
  const [filters, setFilters] = useState({ type: '', category: '' });
  const [search, setSearch]   = useState('');           // what the user is typing, updates instantly
  const [debouncedSearch, setDebouncedSearch] = useState(''); // what actually drives the API call
  const [loading, setLoading] = useState(true);
  // Guards against a race condition debouncing alone doesn't fully solve:
  // if an earlier (slower) request resolves after a later (faster) one,
  // its stale results would otherwise overwrite the current, correct
  // ones. Each fetch is tagged with an incrementing id; only the response
  // matching the most recently *started* request is applied.
  const latestRequestId = useRef(0);

  // Debounce: only update debouncedSearch (and therefore only fire an API
  // call) after the user pauses typing for SEARCH_DEBOUNCE_MS, instead of
  // on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchItems = async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    try {
      const url    = debouncedSearch ? `/items/search?q=${encodeURIComponent(debouncedSearch)}` : '/items';
      const params = debouncedSearch ? {} : { type: filters.type, category: filters.category };
      const { data } = await API.get(url, { params });
      if (requestId === latestRequestId.current) {
        setItems(data);
      } // else: a newer request has since started — discard this stale response
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [filters, debouncedSearch]);

  const lostCount  = items.filter(i => i.type === 'lost').length;
  const foundCount = items.filter(i => i.type === 'found').length;

  const clearSearch = () => { setSearch(''); setDebouncedSearch(''); };
  const clearAll = () => { setFilters({ type: '', category: '' }); clearSearch(); };
  const hasFilters = filters.type || filters.category || search;

  return (
    <div className="page-wrap">
      {/* Page Header */}
      <div className="pg-header">
        <div className="pg-kicker">Campus Portal</div>
        <h1 className="pg-title">
          Browse Items
          {!loading && <span className="result-count">{items.length} results</span>}
        </h1>
        <p className="pg-sub">Find lost or found items reported by students on campus</p>
      </div>

      <div className="row g-4">
        {/* ── Filter Sidebar ── */}
        <div className="col-lg-3 col-md-4">
          <div className="filter-panel">
            <div className="filter-section-title">🎯 Filters</div>

            {/* Search */}
            <div className="field">
              <label className="field-label">Search</label>
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  className="inp"
                  placeholder="Search items…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 36, paddingRight: 32 }}
                />
                {search && (
                  <button className="search-clear" onClick={clearSearch}>✕</button>
                )}
              </div>
            </div>

            {/* Type */}
            <div className="field">
              <label className="field-label">Type</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['', 'lost', 'found'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilters(f => ({ ...f, type: t }))}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      background: filters.type === t
                        ? t === 'lost' ? 'rgba(244,63,94,0.18)' : t === 'found' ? 'rgba(16,185,129,0.18)' : 'var(--neon-dim)'
                        : 'rgba(255,255,255,0.03)',
                      color: filters.type === t
                        ? t === 'lost' ? '#fb7185' : t === 'found' ? '#34d399' : 'var(--neon)'
                        : 'var(--text-3)',
                      border: `1px solid ${filters.type === t
                        ? t === 'lost' ? 'rgba(244,63,94,0.3)' : t === 'found' ? 'rgba(16,185,129,0.3)' : 'rgba(0,229,255,0.3)'
                        : 'var(--border)'}`,
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t === '' ? 'All' : t === 'lost' ? '● Lost' : '● Found'}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="field">
              <label className="field-label">Category</label>
              <select
                className="inp inp-select"
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {hasFilters && (
              <button
                className="btn btn-ghost btn-sm btn-full"
                onClick={clearAll}
                style={{ marginTop: 4 }}
              >
                ✕ Clear Filters
              </button>
            )}

            {/* Quick stats */}
            <div style={{ marginTop: 20, padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 10 }}>
                Current Results
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Lost items</span>
                <span className="badge-pill badge-lost">{lostCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Found items</span>
                <span className="badge-pill badge-found">{foundCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Items Grid ── */}
        <div className="col-lg-9 col-md-8">
          {loading ? (
            <Spinner text="Fetching items…" />
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No Items Found</div>
              <p className="empty-state-sub">Try adjusting your filters or search query.</p>
              {hasFilters && (
                <button className="btn btn-ghost" onClick={clearAll}>Clear All Filters</button>
              )}
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
              {items.map((item, i) => (
                <div key={item._id} className={`col anim-up delay-${Math.min(i + 1, 5)}`}>
                  <ItemCard item={item} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
