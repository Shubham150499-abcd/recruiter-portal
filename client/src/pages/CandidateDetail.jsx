import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, lpa, years, noticeLabel } from '../api.js';
import ShortlistButton from '../components/candidates/ShortlistButton.jsx';
import ScoreCircle from '../components/candidates/ScoreCircle.jsx';
import { formatDate, timeAgo } from '../components/candidates/utils.js';
import '../components/candidates/candidates.css';

export default function CandidateDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState(null);
  const [matchError, setMatchError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [slError, setSlError] = useState('');

  const loadCandidate = useCallback(() => {
    return api.get(`/candidates/${id}`).then(setC);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setC(null);
    setMatches(null);
    setMatchError('');
    api.get(`/candidates/${id}`)
      .then((d) => { if (!cancelled) setC(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    api.get(`/candidates/${id}/matching-jobs`)
      .then((d) => { if (!cancelled) setMatches(d); })
      .catch((e) => { if (!cancelled) setMatchError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  const removeShortlist = async (slId) => {
    setRemoving(slId);
    setSlError('');
    try {
      await api.del(`/shortlists/${slId}`);
      setC((prev) => ({ ...prev, shortlists: prev.shortlists.filter((s) => s.id !== slId) }));
    } catch (e) {
      setSlError(e.message);
    } finally {
      setRemoving(null);
    }
  };

  if (loading) return <div className="card empty">Loading candidate…</div>;
  if (error) {
    return (
      <div>
        <div className="alert alert-error">Couldn't load candidate: {error}</div>
        <Link to="/search" className="btn">← Back to search</Link>
      </div>
    );
  }
  if (!c) return null;

  const initials = (c.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const paragraphs = (c.resume_text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const shortlists = c.shortlists || [];
  const shortlistedJobIds = new Set(shortlists.map((s) => s.job_id));

  return (
    <div>
      <div className="row small" style={{ marginBottom: 12 }}>
        <Link to="/search">← Candidate search</Link>
      </div>

      <section className="card">
        <div className="cd-profile-head">
          <div className="cd-avatar" aria-hidden="true">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cd-card-top">
              <div>
                <h1 style={{ marginBottom: 4 }}>{c.name}</h1>
                {c.headline && <div className="muted">{c.headline}</div>}
                {(c.current_title || c.current_company) && (
                  <div className="cd-current">
                    {c.current_title}{c.current_company ? <> <span className="muted">@</span> {c.current_company}</> : null}
                  </div>
                )}
              </div>
              <div className="cd-card-actions">
                <ShortlistButton candidateId={c.id} shortlisted={shortlists.length > 0} size="sm" onShortlisted={() => loadCandidate().catch(() => {})} />
              </div>
            </div>
          </div>
        </div>
        <dl className="cd-dl">
          <div><dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd></div>
          <div><dt>Phone</dt><dd>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</dd></div>
          <div><dt>Location</dt><dd>{c.location || '—'}</dd></div>
          <div><dt>Preferred locations</dt><dd>{c.preferred_locations?.length ? c.preferred_locations.join(', ') : '—'}</dd></div>
          <div><dt>Experience</dt><dd>{years(c.experience_years)}</dd></div>
          <div><dt>Current CTC</dt><dd>{lpa(c.current_ctc)}</dd></div>
          <div><dt>Expected CTC</dt><dd>{lpa(c.expected_ctc)}</dd></div>
          <div><dt>Notice period</dt><dd>{c.notice_period_days == null ? '—' : noticeLabel(c.notice_period_days)}</dd></div>
          <div><dt>Education</dt><dd>{c.education || '—'}</dd></div>
          <div><dt>Last active</dt><dd title={formatDate(c.last_active)}>{timeAgo(c.last_active)}</dd></div>
        </dl>
      </section>

      <div className="cd-detail-layout" style={{ marginTop: 16 }}>
        <div>
          <section className="card">
            <h2>Skills</h2>
            {c.skills?.length ? (
              <div className="cd-skills">{c.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
            ) : (
              <div className="muted">No skills listed.</div>
            )}
          </section>
          <section className="card">
            <h2>Resume</h2>
            {paragraphs.length ? (
              <div className="cd-resume">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
            ) : (
              <div className="muted">No resume text available.</div>
            )}
          </section>
        </div>

        <aside>
          <section className="card">
            <h2>Shortlisted in</h2>
            {slError && <div className="alert alert-error small">{slError}</div>}
            {shortlists.length === 0 ? (
              <div className="muted">Not shortlisted yet.</div>
            ) : (
              <ul className="cd-sl-list">
                {shortlists.map((s) => (
                  <li key={s.id}>
                    <div style={{ minWidth: 0 }}>
                      {s.job_id ? <Link to={`/jobs/${s.job_id}`}>{s.job_title || `Job #${s.job_id}`}</Link> : <strong>General</strong>}
                      {s.note && <div className="small muted">“{s.note}”</div>}
                    </div>
                    <button className="btn btn-sm btn-danger" disabled={removing === s.id} onClick={() => removeShortlist(s.id)}>
                      {removing === s.id ? '…' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Matching jobs</h2>
            {matchError && <div className="alert alert-error small">{matchError}</div>}
            {!matches && !matchError && <div className="muted">Calculating matches…</div>}
            {matches && matches.length === 0 && <div className="muted">No active jobs to match against.</div>}
            {matches && matches.map((m) => (
              <div key={m.job.id} className="cd-job-match">
                <ScoreCircle score={m.score} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/jobs/${m.job.id}`} style={{ fontWeight: 600 }}>{m.job.title}</Link>
                  <div className="small muted">
                    {m.job.min_exp}–{m.job.max_exp} yrs · {(m.job.locations || []).join(', ')}
                  </div>
                  <div className="cd-skills">
                    {(m.matched_skills || []).map((s) => <span key={`m-${s}`} className="chip chip-match">✓ {s}</span>)}
                    {(m.missing_skills || []).map((s) => <span key={`x-${s}`} className="chip chip-miss">✗ {s}</span>)}
                  </div>
                  <div className="row">
                    <Link to={`/jobs/${m.job.id}/matches`} className="small">All matches for this job →</Link>
                    <span className="spacer" />
                    <ShortlistButton
                      candidateId={c.id}
                      jobId={m.job.id}
                      shortlisted={shortlistedJobIds.has(m.job.id)}
                      onShortlisted={() => loadCandidate().catch(() => {})}
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
