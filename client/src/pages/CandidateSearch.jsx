import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import CandidateCard from '../components/candidates/CandidateCard.jsx';
import TagInput from '../components/candidates/TagInput.jsx';
import Pagination from '../components/candidates/Pagination.jsx';
import { loadMeta, splitList } from '../components/candidates/utils.js';
import '../components/candidates/candidates.css';

const PAGE_SIZE = 20;
const TAG_KEYS = ['keywords', 'any_keywords', 'exclude', 'locations'];
const TEXT_KEYS = ['min_exp', 'max_exp', 'min_ctc', 'max_ctc', 'notice_max', 'active_within', 'company'];

const NOTICE_OPTIONS = [
  ['', 'Any'],
  ['0', 'Immediate'],
  ['15', 'Up to 15 days'],
  ['30', 'Up to 30 days'],
  ['60', 'Up to 60 days'],
  ['90', 'Up to 90 days'],
];
const ACTIVE_OPTIONS = [
  ['', 'Any time'],
  ['7', 'Last 7 days'],
  ['15', 'Last 15 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
];
const SORT_OPTIONS = [
  ['relevance', 'Relevance'],
  ['experience', 'Experience'],
  ['last_active', 'Last active'],
  ['ctc', 'Current CTC'],
];

const LABELS = {
  keywords: 'All', any_keywords: 'Any', exclude: 'Exclude', locations: 'Location',
  min_exp: 'Min exp', max_exp: 'Max exp', min_ctc: 'Min CTC', max_ctc: 'Max CTC',
  notice_max: 'Notice ≤', active_within: 'Active within', company: 'Company',
};

function draftFromParams(sp) {
  const d = {};
  TAG_KEYS.forEach((k) => (d[k] = splitList(sp.get(k))));
  TEXT_KEYS.forEach((k) => (d[k] = sp.get(k) || ''));
  return d;
}

export default function CandidateSearch() {
  const [sp, setSp] = useSearchParams();
  const spKey = sp.toString();
  const [draft, setDraft] = useState(() => draftFromParams(sp));
  const [meta, setMeta] = useState({ skills: [], locations: [] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const sort = sp.get('sort') || 'relevance';

  // Keep the form in sync with the URL (back/forward navigation, shared links).
  useEffect(() => { setDraft(draftFromParams(sp)); }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadMeta().then(setMeta).catch(() => {}); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = Object.fromEntries(sp.entries());
    params.page_size = PAGE_SIZE;
    api.get(`/candidates/search${qs(params)}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchedKeywords = useMemo(
    () => [...splitList(sp.get('keywords')), ...splitList(sp.get('any_keywords'))],
    [spKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const apply = (e) => {
    e && e.preventDefault();
    const next = new URLSearchParams();
    TAG_KEYS.forEach((k) => draft[k].length && next.set(k, draft[k].join(',')));
    TEXT_KEYS.forEach((k) => String(draft[k]).trim() !== '' && next.set(k, String(draft[k]).trim()));
    if (sort !== 'relevance') next.set('sort', sort);
    setSp(next);
    setCollapsed(true);
  };

  const reset = () => setSp(sort !== 'relevance' ? { sort } : {});

  const setParam = (key, value) => {
    const next = new URLSearchParams(sp);
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSp(next);
  };

  const removeFilter = (key, value) => {
    if (TAG_KEYS.includes(key)) {
      const rest = splitList(sp.get(key)).filter((v) => v !== value);
      setParam(key, rest.join(','));
    } else setParam(key, '');
  };

  const goPage = (p) => { setParam('page', p > 1 ? String(p) : ''); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v && v.target ? v.target.value : v }));

  const activeFilters = [];
  TAG_KEYS.forEach((k) => splitList(sp.get(k)).forEach((v) => activeFilters.push({ k, v, label: `${LABELS[k]}: ${v}` })));
  TEXT_KEYS.forEach((k) => {
    const v = sp.get(k);
    if (!v) return;
    let shown = v;
    if (k === 'notice_max') shown = v === '0' ? 'Immediate' : `${v} days`;
    if (k === 'active_within') shown = `${v} days`;
    if (k.includes('ctc')) shown = `${v} LPA`;
    if (k.includes('exp')) shown = `${v} yrs`;
    activeFilters.push({ k, v, label: `${LABELS[k]}: ${shown}` });
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Candidate Search</h1>
          <div className="muted">Find candidates by keywords, experience, salary, location and availability.</div>
        </div>
      </div>

      <div className="sidebar-layout">
        <aside className={`card cd-filters ${collapsed ? 'collapsed' : ''}`}>
          <h3>
            Filters
            <button type="button" className="btn btn-sm cd-filter-toggle" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? 'Show' : 'Hide'}
            </button>
          </h3>
          <form className="cd-filter-body" onSubmit={apply}>
            <div className="field">
              <label htmlFor="f-kw">All keywords</label>
              <TagInput id="f-kw" value={draft.keywords} onChange={set('keywords')} suggestions={meta.skills} placeholder="e.g. React, Node.js" />
              <span className="hint">Candidate must match every keyword</span>
            </div>
            <div className="field">
              <label htmlFor="f-any">Any keywords</label>
              <TagInput id="f-any" value={draft.any_keywords} onChange={set('any_keywords')} suggestions={meta.skills} placeholder="e.g. AWS, GCP" />
            </div>
            <div className="field">
              <label htmlFor="f-ex">Exclude keywords</label>
              <TagInput id="f-ex" value={draft.exclude} onChange={set('exclude')} suggestions={meta.skills} placeholder="e.g. Intern" />
            </div>
            <div className="field">
              <label htmlFor="f-minexp">Experience (years)</label>
              <div className="cd-range">
                <input id="f-minexp" type="number" min="0" max="50" placeholder="Min" value={draft.min_exp} onChange={set('min_exp')} />
                <span className="muted">to</span>
                <input aria-label="Maximum experience" type="number" min="0" max="50" placeholder="Max" value={draft.max_exp} onChange={set('max_exp')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-minctc">Current CTC (LPA)</label>
              <div className="cd-range">
                <input id="f-minctc" type="number" min="0" step="0.5" placeholder="Min" value={draft.min_ctc} onChange={set('min_ctc')} />
                <span className="muted">to</span>
                <input aria-label="Maximum CTC" type="number" min="0" step="0.5" placeholder="Max" value={draft.max_ctc} onChange={set('max_ctc')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-loc">Locations</label>
              <TagInput id="f-loc" value={draft.locations} onChange={set('locations')} suggestions={meta.locations} placeholder="Current or preferred" />
            </div>
            <div className="field">
              <label htmlFor="f-notice">Notice period</label>
              <select id="f-notice" value={draft.notice_max} onChange={set('notice_max')}>
                {NOTICE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-active">Active within</label>
              <select id="f-active" value={draft.active_within} onChange={set('active_within')}>
                {ACTIVE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-company">Current company</label>
              <input id="f-company" value={draft.company} onChange={set('company')} placeholder="e.g. Infosys" />
            </div>
            <div className="cd-filter-actions">
              <button type="button" className="btn" onClick={reset}>Reset</button>
              <button type="submit" className="btn btn-primary">Search</button>
            </div>
          </form>
        </aside>

        <section aria-live="polite">
          <div className="cd-results-head">
            <div>
              {loading && !data ? (
                <span className="muted">Searching…</span>
              ) : data ? (
                <>
                  <strong>{data.total.toLocaleString()}</strong> candidate{data.total === 1 ? '' : 's'} found
                  {data.total > 0 && (
                    <span className="muted small"> · showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.total, data.page * data.page_size)}</span>
                  )}
                </>
              ) : null}
            </div>
            <label className="row small">
              <span className="muted">Sort by</span>
              <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'relevance' ? '' : e.target.value)}>
                {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>

          {activeFilters.length > 0 && (
            <div className="cd-active-filters">
              {activeFilters.map((f) => (
                <span key={`${f.k}-${f.v}`} className="chip">
                  {f.label}
                  <button type="button" aria-label={`Remove filter ${f.label}`} onClick={() => removeFilter(f.k, f.v)}>×</button>
                </span>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Clear all</button>
            </div>
          )}

          {error && <div className="alert alert-error">Couldn't load candidates: {error}</div>}

          {loading && !data && <LoadingCards />}

          {data && (
            <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
              {data.results.length === 0 ? (
                <div className="card empty">
                  <h3>No candidates match these filters</h3>
                  <p>Try removing a keyword, widening the experience or salary range, or adding more locations.</p>
                  {activeFilters.length > 0 && <button className="btn" onClick={reset}>Clear filters</button>}
                </div>
              ) : (
                data.results.map((c) => <CandidateCard key={c.id} candidate={c} keywords={searchedKeywords} />)
              )}
              <Pagination page={data.page || page} pageSize={data.page_size || PAGE_SIZE} total={data.total} onChange={goPage} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function LoadingCards() {
  return [0, 1, 2].map((i) => (
    <div key={i} className="card" aria-hidden="true">
      <div className="cd-skeleton" style={{ width: '35%' }} />
      <div className="cd-skeleton" style={{ width: '60%' }} />
      <div className="cd-skeleton" style={{ width: '80%' }} />
    </div>
  ));
}
