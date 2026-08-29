export function ResultFilters({ search, onSearch }: { search: string; onSearch(value: string): void }) {
  return <aside className="results-filters"><h2>Filters</h2><label>Search recovered files<input type="search" value={search} onChange={(event) => onSearch(event.target.value)} /></label><p className="form-hint">Additional result filters are unavailable until the daemon exposes typed multi-value filter inputs.</p></aside>;
}
