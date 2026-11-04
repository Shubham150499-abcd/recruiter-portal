import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, years, lpa, noticeLabel } from '../api.js';
import {
  StatusBadge, expRange, salaryRange, fmtDate, scoreClass, Loading, ErrorAlert, statusActionLabel,
} from '../components/jobs/common.jsx';
import useJobActions from '../components/jobs/useJobActions.js';
import '../components/jobs/jobs.css';

function TopMatches({ jobId, total }) {
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    setMatches(null);
    api.get(`/jobs/${jobId}/matches?limit=5`)
      .then((m) => setMatches(m || []))
      .catch((e) => setError(e.message));
  }, [jobId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card">
      <div className="jd-section-title">
        <h2>Top matching candidates</h2>
        <Link to={`/jobs/${jobId}/matches`} className="small">See all →</Link>
      </div>
      {error ? (
        <ErrorAlert error={`Could not load matches: ${error}`} onRetry={load} />
      ) : !matches ? (
        <>{[0, 1, 2].map((i) => <div key={i} className="jd-skel" style={{ height: 40 }} />)}</>
      ) : matches.length === 0 ? (
        <div className="empty">No matching candidates yet. Try broadening skills or locations.</div>
      ) : (
        <ul className="jd-list">
          {matches.map(({ candidate: c, score, matched_skills: ms = [], missing_skills: miss = [] }) => (
            <li key={c.id} className="jd-match-row">
              <span className={`score ${scoreClass(score)}`} title={`Match score ${score}/100`}>{score}</span>
              <div className="info">
                <div className="row">
                  <Link to={`/candidates/${c.id}`} style={{ fontWeight: 600 }}>{c.name}</Link>
                  {c.is_shortlisted && <span className="badge badge-active">Shortlisted</span>}
                </div>
                <div className="muted small">
                  {[c.current_title && c.current_company ? `${c.current_title} at ${c.current_company}` : c.current_title || c.headline, c.location].filter(Boolean).join(' · ')}
                </div>
                <div className="jd-meta">
                  <span>{years(c.experience_years)}</span>
                  <span>Expects {lpa(c.expected_ctc)}</span>
                  {c.notice_period_days != null && <span>Notice: {noticeLabel(c.notice_period_days)}</span>}
                </div>
                <div className="row" style={{ marginTop: 4 }}>
                  {ms.map((s) => <span key={s} className="chip chip-match">✓ {s}</span>)}
                  {miss.slice(0, 3).map((s) => <span key={s} className="chip chip-miss">{s}</span>)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {matches && matches.length > 0 && (
        <Link to={`/jobs/${jobId}/matches`} className="btn btn-primary jd-cta" style={{ marginTop: 12 }}>
          View all {total ?? ''} matching candidates
        </Link>
      )}
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [flash, setFlash] = useState(location.state?.flash || '');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.get(`/jobs/${id}`)
      .then(setJob)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // GET /jobs/:id may not include match_count; derive it from the matches endpoint if missing.
  const [derivedCount, setDerivedCount] = useState(null);
  useEffect(() => {
    if (!job || job.match_count != null) return undefined;
    let alive = true;
    api.get(`/jobs/${job.id}/matches?min_score=50&limit=1000`)
      .then((m) => { if (alive) setDerivedCount(Array.isArray(m) ? m.length : null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [job?.id, job?.match_count]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear router flash state so it doesn't reappear on refresh/back.
  useEffect(() => {
    if (location.state?.flash) navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { busyId, toggleStatus, remove } = useJobActions({
    onUpdated: (u) => { setJob((j) => ({ ...j, ...u })); setFlash(`Job is now ${u.status}.`); setActionError(''); },
    onDeleted: () => navigate('/jobs', { replace: true }),
    onError: setActionError,
  });

  if (loading && !job) return <Loading lines={6} />;
  if (error) {
    return (
      <div>
        <ErrorAlert error={error.match(/not found|404/i) ? 'This job was not found. It may have been deleted.' : `Could not load job: ${error}`} onRetry={load} />
        <Link to="/jobs" className="btn">← Back to jobs</Link>
      </div>
    );
  }
  if (!job) return null;

  const busy = busyId === job.id;
  const matchCount = job.match_count ?? derivedCount;

  const facts = [
    ['Experience', expRange(job.min_exp, job.max_exp)],
    ['Salary', salaryRange(job.min_salary, job.max_salary)],
    ['Locations', (job.locations || []).join(', ') || '—'],
    ['Employment type', job.employment_type || '—'],
    ['Work mode', job.work_mode || '—'],
    ['Openings', job.openings ?? '—'],
    ['Education', job.education || 'Any'],
    ['Industry', job.industry || '—'],
    ['Functional area', job.functional_area || '—'],
    ['Posted on', fmtDate(job.created_at)],
    ['Last updated', fmtDate(job.updated_at)],
  ];

  return (
    <div>
      <Link to="/jobs" className="small">← All jobs</Link>
      <div className="page-header" style={{ marginTop: 4 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row">
            <h1 style={{ margin: 0 }}>{job.title}</h1>
            <StatusBadge status={job.status} />
          </div>
          <div className="jd-meta">
            <span>{expRange(job.min_exp, job.max_exp)}</span>
            <span>{salaryRange(job.min_salary, job.max_salary)}</span>
            <span>{(job.locations || []).join(', ')}</span>
          </div>
        </div>
        <div className="jd-actions">
          <Link to={`/jobs/${job.id}/edit`} className="btn">Edit</Link>
          <button className="btn" disabled={busy} onClick={() => toggleStatus(job)}>{statusActionLabel(job.status)}</button>
          <button className="btn btn-danger" disabled={busy} onClick={() => remove(job)}>Delete</button>
        </div>
      </div>

      {flash && (
        <div className="alert alert-success row" role="status">
          <span className="spacer">{flash}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setFlash('')} aria-label="Dismiss">×</button>
        </div>
      )}
      <ErrorAlert error={actionError} />
      {job.status === 'draft' && (
        <div className="alert" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
          This job is a draft and is not visible to candidates. Publish it when ready.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px', alignItems: 'start' }} data-resp="detail">
        <div>
          <Link to={`/jobs/${job.id}/matches`} className="card jd-hero" style={{ textDecoration: 'none' }}>
            <div>
              <div className="stat" style={{ color: '#fff' }}>{matchCount ?? '—'}</div>
              <div className="muted">candidates match this job (score ≥ 50)</div>
            </div>
            <span className="btn btn-primary">View {matchCount ?? ''} matching candidates →</span>
          </Link>

          <div className="card">
            <h2>Key skills</h2>
            {(job.skills || []).length
              ? <div className="row">{job.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
              : <span className="muted">No skills listed.</span>}
          </div>

          <div className="card">
            <h2>Job description</h2>
            <div className="jd-desc">{job.description || <span className="muted">No description.</span>}</div>
          </div>

          <TopMatches jobId={job.id} total={matchCount} />
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <h3>Job overview</h3>
          <dl className="jd-dl" style={{ gridTemplateColumns: '120px minmax(0,1fr)' }}>
            {facts.map(([k, v]) => (
              <FactRow key={k} k={k} v={v} />
            ))}
          </dl>
          {job.shortlist_count != null && (
            <>
              <div className="divider" />
              <Link to={`/shortlists?job=${job.id}`}>{job.shortlist_count} candidates shortlisted →</Link>
            </>
          )}
          <div className="divider" />
          <span className="muted small">Job ID #{job.id}</span>
        </div>
      </div>
    </div>
  );
}

function FactRow({ k, v }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
