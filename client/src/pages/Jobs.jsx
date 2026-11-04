import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { StatusBadge, expRange, salaryRange, fmtDate, timeAgo, Loading, ErrorAlert, statusActionLabel } from '../components/jobs/common.jsx';
import useJobActions from '../components/jobs/useJobActions.js';
import '../components/jobs/jobs.css';

const TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'closed', label: 'Closed' },
];

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const status = TABS.some((t) => t.key === params.get('status')) ? params.get('status') : '';
  const q = params.get('q') || '';
  const [text, setText] = useState(q);
  const [jobs, setJobs] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reqId = useRef(0);

  const load = useCallback(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/jobs${qs({ status, q })}`),
      api.get(`/jobs${qs({ q })}`).catch(() => null), // for tab counts
    ])
      .then(([list, all]) => {
        if (id !== reqId.current) return;
        setJobs(list || []);
        if (all) {
          const c = { '': all.length, active: 0, draft: 0, closed: 0 };
          all.forEach((j) => { if (c[j.status] !== undefined) c[j.status] += 1; });
          setCounts(c);
        }
      })
      .catch((e) => { if (id === reqId.current) setError(e.message); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [status, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setText(q); }, [q]);

  // Debounced search -> URL
  useEffect(() => {
    if (text === q) return undefined;
    const t = setTimeout(() => updateParams({ q: text.trim() }), 350);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateParams(patch) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  }

  const { busyId, toggleStatus, remove } = useJobActions({
    onUpdated: (u) => {
      setNotice(`"${u.title}" is now ${u.status}.`);
      load();
    },
    onDeleted: (j) => {
      setNotice(`"${j.title}" was deleted.`);
      load();
    },
    onError: setError,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manage jobs</h1>
          <div className="muted small">Track your postings and the candidates matching them.</div>
        </div>
        <Link to="/jobs/new" className="btn btn-primary">+ Post a job</Link>
      </div>

      <div className="tabs jd-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key || 'all'}
            role="tab"
            aria-selected={status === t.key}
            className={status === t.key ? 'active' : ''}
            onClick={() => updateParams({ status: t.key })}
          >
            {t.label}
            {counts && <span className="count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <form className="jd-search" role="search" onSubmit={(e) => { e.preventDefault(); updateParams({ q: text.trim() }); }}>
        <input type="search" placeholder="Search jobs by title, skill or keyword" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search jobs" />
        <button type="submit" className="btn">Search</button>
      </form>

      {notice && (
        <div className="alert alert-success row" role="status">
          <span className="spacer">{notice}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setNotice('')} aria-label="Dismiss">×</button>
        </div>
      )}
      <ErrorAlert error={error} onRetry={load} />

      {loading && !jobs ? (
        <Loading lines={4} />
      ) : jobs && jobs.length === 0 ? (
        <div className="card empty">
          {q ? (
            <p>No jobs match “{q}”{status ? ` in ${status} jobs` : ''}.</p>
          ) : (
            <p>No {status || ''} jobs yet.</p>
          )}
          {q ? (
            <button className="btn" onClick={() => { setText(''); updateParams({ q: '' }); }}>Clear search</button>
          ) : (
            <Link to="/jobs/new" className="btn btn-primary">Post a job</Link>
          )}
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          {(jobs || []).map((j) => (
            <div className="card" key={j.id}>
              <div className="jd-job-row">
                <div className="jd-job-main">
                  <div className="row">
                    <Link to={`/jobs/${j.id}`} className="jd-job-title">{j.title}</Link>
                    <StatusBadge status={j.status} />
                  </div>
                  <div className="jd-meta">
                    <span>💼 {expRange(j.min_exp, j.max_exp)}</span>
                    <span>₹ {salaryRange(j.min_salary, j.max_salary)}</span>
                    <span>📍 {(j.locations || []).join(', ') || '—'}</span>
                  </div>
                  {(j.skills || []).length > 0 && (
                    <div className="row" style={{ marginTop: 6 }}>
                      {j.skills.slice(0, 6).map((s) => <span key={s} className="chip">{s}</span>)}
                      {j.skills.length > 6 && <span className="muted small">+{j.skills.length - 6} more</span>}
                    </div>
                  )}
                  <div className="muted small" style={{ marginTop: 6 }} title={fmtDate(j.created_at)}>
                    Posted {timeAgo(j.created_at)}
                  </div>
                </div>
                <div className="jd-job-side">
                  <div className="jd-counts">
                    <Link to={`/jobs/${j.id}/matches`}>{j.match_count ?? 0} matching candidates</Link>
                    <Link to={`/shortlists?job=${j.id}`} className="muted">{j.shortlist_count ?? 0} shortlisted</Link>
                  </div>
                  <div className="jd-actions">
                    <Link to={`/jobs/${j.id}`} className="btn btn-sm">View</Link>
                    <Link to={`/jobs/${j.id}/edit`} className="btn btn-sm">Edit</Link>
                    <button className="btn btn-sm" disabled={busyId === j.id} onClick={() => toggleStatus(j)}>
                      {statusActionLabel(j.status)}
                    </button>
                    <button className="btn btn-sm btn-danger" disabled={busyId === j.id} onClick={() => remove(j)}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
