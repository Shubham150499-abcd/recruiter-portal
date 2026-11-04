import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, qs, lpa, years, noticeLabel } from '../api.js';
import ScoreCircle from '../components/candidates/ScoreCircle.jsx';
import Breakdown, { BREAKDOWN_PARTS } from '../components/candidates/Breakdown.jsx';
import ShortlistButton from '../components/candidates/ShortlistButton.jsx';
import { timeAgo } from '../components/candidates/utils.js';
import '../components/candidates/candidates.css';

const LIMITS = [10, 25, 50, 100];
const MAX_COMPARE = 3;

export default function JobMatches() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const minScore = clamp(parseInt(sp.get('min_score') ?? '0', 10), 0, 100);
  const limit = LIMITS.includes(Number(sp.get('limit'))) ? Number(sp.get('limit')) : 25;

  const [job, setJob] = useState(null);
  const [jobError, setJobError] = useState('');
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slider, setSlider] = useState(minScore);
  const [compare, setCompare] = useState([]); // candidate ids
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => setSlider(minScore), [minScore]);

  // Debounce slider -> URL
  useEffect(() => {
    if (slider === minScore) return undefined;
    const t = setTimeout(() => updateParam('min_score', slider ? String(slider) : ''), 300);
    return () => clearTimeout(t);
  }, [slider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setJobError('');
    api.get(`/jobs/${id}`)
      .then((j) => { if (!cancelled) setJob(j); })
      .catch((e) => { if (!cancelled) setJobError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/jobs/${id}/matches${qs({ min_score: minScore, limit })}`)
      .then((d) => { if (!cancelled) setMatches(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, minScore, limit]);

  function updateParam(key, value) {
    const next = new URLSearchParams(sp);
    if (value === '' || value == null) next.delete(key); else next.set(key, value);
    setSp(next, { replace: true });
  }

  const toggleCompare = (cid) => {
    setCompare((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : prev.length >= MAX_COMPARE ? prev : [...prev, cid]));
  };

  const compared = useMemo(
    () => (matches || []).filter((m) => compare.includes(m.candidate.id)),
    [matches, compare],
  );

  if (jobError) {
    return (
      <div>
        <div className="alert alert-error">Couldn't load job: {jobError}</div>
        <Link to="/jobs" className="btn">← Back to jobs</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="row small" style={{ marginBottom: 12 }}>
        <Link to={`/jobs/${id}`}>← Back to job</Link>
      </div>

      <section className="card">
        {job ? (
          <>
            <div className="cd-card-top">
              <div>
                <div className="small muted">Candidate matches for</div>
                <h1 style={{ marginBottom: 4 }}>{job.title}</h1>
                <div className="muted">
                  {job.min_exp}–{job.max_exp} yrs · {(job.locations || []).join(', ')}
                  {job.max_salary ? ` · up to ${lpa(job.max_salary)}` : ''}
                  {job.work_mode ? ` · ${job.work_mode}` : ''}
                  {job.status && <> · <span className={`badge badge-${job.status}`}>{job.status}</span></>}
                </div>
              </div>
              <Link to={`/jobs/${id}`} className="btn btn-sm">View job</Link>
            </div>
            {job.skills?.length > 0 && (
              <div className="cd-skills">{job.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
            )}
          </>
        ) : (
          <>
            <div className="cd-skeleton" style={{ width: '40%' }} />
            <div className="cd-skeleton" style={{ width: '70%' }} />
          </>
        )}
      </section>

      <section className="card cd-controls" aria-label="Match filters">
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label htmlFor="jm-min">Minimum score: <strong>{slider}</strong></label>
          <input id="jm-min" type="range" min="0" max="100" step="5" value={slider} onChange={(e) => setSlider(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="jm-limit">Show top</label>
          <select id="jm-limit" value={limit} onChange={(e) => updateParam('limit', e.target.value === '25' ? '' : e.target.value)}>
            {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="small muted" style={{ flex: '1 1 220px' }}>
          Score weights: {BREAKDOWN_PARTS.map((p) => `${p.label} ${p.weight}%`).join(' · ')}
        </div>
      </section>

      <div aria-live="polite" style={{ marginTop: 12 }}>
        {error && <div className="alert alert-error">Couldn't load matches: {error}</div>}
        {loading && !matches && <div className="card empty">Ranking candidates…</div>}
        {matches && (
          <div style={{ opacity: loading ? 0.55 : 1 }}>
            <div className="cd-results-head">
              <div><strong>{matches.length}</strong> candidate{matches.length === 1 ? '' : 's'} with score ≥ {minScore}</div>
              <div className="small muted">Tick up to {MAX_COMPARE} candidates to compare</div>
            </div>
            {matches.length === 0 ? (
              <div className="card empty">
                <h3>No candidates at this score</h3>
                <p>Lower the minimum score to see more candidates.</p>
                {minScore > 0 && <button className="btn" onClick={() => setSlider(0)}>Reset minimum score</button>}
              </div>
            ) : (
              matches.map((m, i) => (
                <MatchRow
                  key={m.candidate.id}
                  rank={i + 1}
                  match={m}
                  jobId={Number(id)}
                  checked={compare.includes(m.candidate.id)}
                  disabled={!compare.includes(m.candidate.id) && compare.length >= MAX_COMPARE}
                  onToggle={() => toggleCompare(m.candidate.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {compare.length > 0 && (
        <div className="cd-compare-bar" role="region" aria-label="Compare selection">
          <strong>{compare.length}/{MAX_COMPARE} selected</strong>
          <span className="small muted" style={{ minWidth: 0 }}>{compared.map((m) => m.candidate.name).join(', ')}</span>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => { setCompare([]); setShowCompare(false); }}>Clear</button>
          <button className="btn btn-sm btn-primary" disabled={compare.length < 2} onClick={() => setShowCompare((s) => !s)}>
            {showCompare ? 'Hide comparison' : 'Compare'}
          </button>
        </div>
      )}

      {showCompare && compared.length >= 2 && <CompareTable items={compared} />}
    </div>
  );
}

function MatchRow({ rank, match: m, jobId, checked, disabled, onToggle }) {
  const c = m.candidate;
  return (
    <article className="card cd-match">
      <div className="cd-rank">#{rank}</div>
      <div className="cd-match-score">
        <ScoreCircle score={m.score} />
        <label className="cd-compare-check" title={disabled ? `You can compare up to ${MAX_COMPARE}` : 'Add to comparison'}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} /> Compare
        </label>
      </div>
      <div className="cd-match-body">
        <div className="cd-card-top">
          <div>
            <Link to={`/candidates/${c.id}`} className="cd-name">{c.name}</Link>
            <div className="cd-headline">
              {c.current_title}{c.current_company ? ` @ ${c.current_company}` : ''}
            </div>
          </div>
          <div className="cd-card-actions">
            <Link to={`/candidates/${c.id}`} className="btn btn-sm">View profile</Link>
            <ShortlistButton candidateId={c.id} jobId={jobId} />
          </div>
        </div>
        <ul className="cd-facts">
          <li>💼 {years(c.experience_years)}</li>
          <li>₹ {lpa(c.current_ctc)} <span className="muted">→ {lpa(c.expected_ctc)}</span></li>
          <li>📍 {c.location || '—'}</li>
          <li>⏱ {c.notice_period_days == null ? '—' : noticeLabel(c.notice_period_days)}</li>
          <li className="muted">Active {timeAgo(c.last_active)}</li>
        </ul>
        <Breakdown breakdown={m.breakdown} />
        <div className="cd-skills">
          {(m.matched_skills || []).map((s) => <span key={`m-${s}`} className="chip chip-match">✓ {s}</span>)}
          {(m.missing_skills || []).map((s) => <span key={`x-${s}`} className="chip chip-miss">✗ {s}</span>)}
        </div>
      </div>
    </article>
  );
}

function CompareTable({ items }) {
  const best = (vals, higher = true) => {
    const nums = vals.map((v) => (v == null ? NaN : Number(v)));
    const valid = nums.filter((n) => !Number.isNaN(n));
    if (!valid.length) return -1;
    const target = higher ? Math.max(...valid) : Math.min(...valid);
    return valid.filter((n) => n === target).length === valid.length ? -1 : nums.indexOf(target);
  };

  const rows = [
    { label: 'Score', vals: items.map((m) => m.score), render: (v) => <strong>{v}</strong>, higher: true },
    ...BREAKDOWN_PARTS.map((p) => ({ label: `${p.label} (${p.weight}%)`, vals: items.map((m) => m.breakdown?.[p.key]), higher: true })),
    { label: 'Experience', vals: items.map((m) => m.candidate.experience_years), render: (v) => years(v) },
    { label: 'Current CTC', vals: items.map((m) => m.candidate.current_ctc), render: (v) => lpa(v) },
    { label: 'Expected CTC', vals: items.map((m) => m.candidate.expected_ctc), render: (v) => lpa(v), higher: false },
    { label: 'Notice', vals: items.map((m) => m.candidate.notice_period_days), render: (v) => (v == null ? '—' : noticeLabel(v)), higher: false },
    { label: 'Location', vals: items.map((m) => m.candidate.location || '—') },
    { label: 'Last active', vals: items.map((m) => timeAgo(m.candidate.last_active)) },
  ];

  return (
    <section className="card" style={{ marginTop: 12 }} aria-label="Candidate comparison">
      <h2>Side-by-side comparison</h2>
      <div className="cd-table-wrap">
        <table className="cd-compare-table">
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              {items.map((m) => (
                <th scope="col" key={m.candidate.id}>
                  <Link to={`/candidates/${m.candidate.id}`}>{m.candidate.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bi = r.higher === undefined ? -1 : best(r.vals, r.higher);
              return (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.vals.map((v, i) => (
                    <td key={i} className={i === bi ? 'cd-best' : ''}>{r.render ? r.render(v) : v ?? '—'}</td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <th scope="row">Matched skills</th>
              {items.map((m) => (
                <td key={m.candidate.id}>{(m.matched_skills || []).map((s) => <span key={s} className="chip chip-match">{s}</span>)}{!m.matched_skills?.length && '—'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Missing skills</th>
              {items.map((m) => (
                <td key={m.candidate.id}>{(m.missing_skills || []).map((s) => <span key={s} className="chip chip-miss">{s}</span>)}{!m.missing_skills?.length && '—'}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>Green cells mark the strongest value in each row.</p>
    </section>
  );
}

function clamp(n, lo, hi) {
  return Number.isNaN(n) ? lo : Math.max(lo, Math.min(hi, n));
}
