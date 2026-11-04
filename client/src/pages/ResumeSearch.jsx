import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, lpa, years, noticeLabel } from '../api.js';
import TagInput from '../components/candidates/TagInput.jsx';
import Pagination from '../components/candidates/Pagination.jsx';
import ShortlistButton from '../components/candidates/ShortlistButton.jsx';
import { loadMeta, splitList, timeAgo } from '../components/candidates/utils.js';
import '../components/candidates/candidates.css';

const PAGE_SIZE = 20;
const EXAMPLES = [
  '"machine learning" AND (python OR R) NOT intern',
  'react AND (node OR "next.js") NOT angular',
  '(java OR kotlin) AND "spring boot" AND microservices',
];

export default function ResumeSearch() {
  const [sp, setSp] = useSearchParams();
  const spKey = sp.toString();
  const q = sp.get('q') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);

  const [query, setQuery] = useState(q);
  const [minExp, setMinExp] = useState(sp.get('min_exp') || '');
  const [maxExp, setMaxExp] = useState(sp.get('max_exp') || '');
  const [locations, setLocations] = useState(splitList(sp.get('locations')));
  const [meta, setMeta] = useState({ locations: [] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { loadMeta().then(setMeta).catch(() => {}); }, []);

  // Sync form with URL (back/forward, shared links)
  useEffect(() => {
    setQuery(sp.get('q') || '');
    setMinExp(sp.get('min_exp') || '');
    setMaxExp(sp.get('max_exp') || '');
    setLocations(splitList(sp.get('locations')));
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!q.trim()) { setData(null); setError(''); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    const body = { query: q, page, page_size: PAGE_SIZE };
    if (sp.get('min_exp')) body.min_exp = Number(sp.get('min_exp'));
    if (sp.get('max_exp')) body.max_exp = Number(sp.get('max_exp'));
    const locs = splitList(sp.get('locations'));
    if (locs.length) body.locations = locs;
    api.post('/resumes/search', body)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) { setError(e.message); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (overrideQuery) => {
    const next = new URLSearchParams();
    const qq = (overrideQuery ?? query).trim();
    if (qq) next.set('q', qq);
    if (minExp !== '') next.set('min_exp', minExp);
    if (maxExp !== '') next.set('max_exp', maxExp);
    if (locations.length) next.set('locations', locations.join(','));
    setSp(next);
  };

  const onSubmit = (e) => { e.preventDefault(); run(); };

  const goPage = (p) => {
    const next = new URLSearchParams(sp);
    if (p > 1) next.set('page', String(p)); else next.delete('page');
    setSp(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Resume Search</h1>
          <div className="muted">Boolean full-text search across every resume in the database.</div>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="rs-q">Search query</label>
          <textarea
            id="rs-q"
            ref={inputRef}
            className="cd-query"
            value={query}
            placeholder={'e.g. "data engineer" AND (spark OR airflow) NOT intern'}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
            aria-describedby="rs-help"
            aria-invalid={!!error}
          />
        </div>
        <div id="rs-help" className="cd-syntax">
          <span><code>AND</code> both terms must appear</span>
          <span><code>OR</code> either term may appear</span>
          <span><code>NOT</code> exclude a term</span>
          <span><code>"exact phrase"</code> match words together</span>
          <span><code>( … )</code> group expressions</span>
          <span>Adjacent terms default to AND · case-insensitive</span>
        </div>
        <div className="row small" style={{ marginBottom: 12 }}>
          <span className="muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="cd-example" onClick={() => { setQuery(ex); run(ex); }}>
              {ex}
            </button>
          ))}
        </div>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="rs-min">Min experience (yrs)</label>
            <input id="rs-min" type="number" min="0" value={minExp} onChange={(e) => setMinExp(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rs-max">Max experience (yrs)</label>
            <input id="rs-max" type="number" min="0" value={maxExp} onChange={(e) => setMaxExp(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rs-loc">Locations</label>
            <TagInput id="rs-loc" value={locations} onChange={setLocations} suggestions={meta.locations} placeholder="Any location" />
          </div>
        </div>
        <div className="row">
          <span className="spacer" />
          {q && <button type="button" className="btn" onClick={() => { setQuery(''); setSp({}); inputRef.current?.focus(); }}>Clear</button>}
          <button type="submit" className="btn btn-primary" disabled={!query.trim()}>Search resumes</button>
        </div>
      </form>

      <div style={{ marginTop: 16 }} aria-live="polite">
        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Query error:</strong> {error}
          </div>
        )}

        {!q && !error && (
          <div className="card empty">
            Enter a boolean query above, or click one of the examples to get started.
          </div>
        )}

        {loading && !data && <div className="card empty">Searching resumes…</div>}

        {data && (
          <div style={{ opacity: loading ? 0.55 : 1 }}>
            <div className="cd-results-head">
              <div>
                <strong>{data.total.toLocaleString()}</strong> resume{data.total === 1 ? '' : 's'} matched <span className="muted">for</span> <code>{q}</code>
              </div>
            </div>
            {data.results.length === 0 ? (
              <div className="card empty">
                <h3>No resumes matched</h3>
                <p>Try OR-ing synonyms, removing a NOT clause, or loosening the experience/location filters.</p>
              </div>
            ) : (
              data.results.map((r) => <ResumeHit key={r.candidate.id} hit={r} />)
            )}
            <Pagination page={data.page || page} pageSize={data.page_size || PAGE_SIZE} total={data.total} onChange={goPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeHit({ hit }) {
  const c = hit.candidate;
  return (
    <article className="card">
      <div className="cd-card-top">
        <div>
          <Link to={`/candidates/${c.id}`} className="cd-name">{c.name}</Link>{' '}
          <span className="cd-hits">{hit.hits} hit{hit.hits === 1 ? '' : 's'}</span>
          <div className="cd-headline">
            {c.current_title}{c.current_company ? ` @ ${c.current_company}` : ''}
          </div>
        </div>
        <div className="cd-card-actions">
          <Link to={`/candidates/${c.id}`} className="btn btn-sm">View resume</Link>
          <ShortlistButton candidateId={c.id} shortlisted={!!c.is_shortlisted} />
        </div>
      </div>
      <ul className="cd-facts">
        <li>💼 {years(c.experience_years)}</li>
        <li>₹ {lpa(c.current_ctc)} <span className="muted">→ {lpa(c.expected_ctc)}</span></li>
        <li>📍 {c.location || '—'}</li>
        <li>⏱ {c.notice_period_days == null ? '—' : noticeLabel(c.notice_period_days)}</li>
        <li className="muted">Active {timeAgo(c.last_active)}</li>
      </ul>
      {hit.snippets?.length > 0 && (
        <ul className="cd-snippets">
          {hit.snippets.map((s, i) => (
            // SAFETY: per CONTRACT.md the backend HTML-escapes all snippet text and only
            // inserts <mark>…</mark> around matched terms, so rendering it as HTML is safe.
            <li key={i} dangerouslySetInnerHTML={{ __html: s }} />
          ))}
        </ul>
      )}
    </article>
  );
}
