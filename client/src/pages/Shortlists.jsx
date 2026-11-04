import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs, lpa, years, noticeLabel } from '../api.js';
import { formatDate } from '../components/candidates/utils.js';
import '../components/candidates/candidates.css';

// Filter values: '' = all, 'general' = no job, otherwise a job id.
export default function Shortlists() {
  const [sp, setSp] = useSearchParams();
  const filter = sp.get('job') || '';
  const [jobs, setJobs] = useState([]);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => { api.get('/jobs').then(setJobs).catch(() => setJobs([])); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    // "General" is filtered client-side (job_id null) since the API's job_id filter targets a specific job.
    const path = filter && filter !== 'general' ? `/shortlists${qs({ job_id: filter })}` : '/shortlists';
    api.get(path)
      .then((d) => { if (!cancelled) setItems(filter === 'general' ? d.filter((s) => s.job_id == null) : d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  const remove = async (s) => {
    if (!window.confirm(`Remove ${s.candidate?.name || 'this candidate'} from ${s.job_title || 'General'} shortlist?`)) return;
    setRemoving(s.id);
    setActionError('');
    try {
      await api.del(`/shortlists/${s.id}`);
      setItems((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      setActionError(e.message);
    } finally {
      setRemoving(null);
    }
  };

  const setFilter = (v) => setSp(v ? { job: v } : {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Shortlists</h1>
          <div className="muted">Candidates you've saved, by job.</div>
        </div>
        <label className="row">
          <span className="muted small">Job</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }}>
            <option value="">All shortlists</option>
            <option value="general">General (no job)</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}{j.status !== 'active' ? ` (${j.status})` : ''}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-error">Couldn't load shortlists: {error}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      {loading && !items && <div className="card empty">Loading shortlists…</div>}

      {items && (
        <div className="card" style={{ opacity: loading ? 0.55 : 1 }}>
          {items.length === 0 ? (
            <div className="empty">
              <h3>No shortlisted candidates{filter ? ' for this filter' : ' yet'}</h3>
              <p>Shortlist candidates from <Link to="/search">Candidate Search</Link>, <Link to="/resume-search">Resume Search</Link> or a job's matches.</p>
            </div>
          ) : (
            <>
              <div className="small muted" style={{ marginBottom: 8 }}>{items.length} shortlisted</div>
              <div className="cd-table-wrap">
                <table className="cd-sl-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Details</th>
                      <th>Job</th>
                      <th>Note</th>
                      <th>Added</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => {
                      const c = s.candidate || {};
                      return (
                        <tr key={s.id}>
                          <td>
                            <Link to={`/candidates/${c.id}`} style={{ fontWeight: 600 }}>{c.name}</Link>
                            <div className="small muted">{c.current_title}{c.current_company ? ` @ ${c.current_company}` : ''}</div>
                          </td>
                          <td className="small">
                            {years(c.experience_years)} · {c.location || '—'}
                            <div className="muted">{lpa(c.current_ctc)} → {lpa(c.expected_ctc)} · {c.notice_period_days == null ? '—' : noticeLabel(c.notice_period_days)}</div>
                          </td>
                          <td data-label="Job">
                            {s.job_id ? <Link to={`/jobs/${s.job_id}`}>{s.job_title || `Job #${s.job_id}`}</Link> : <span className="chip">General</span>}
                          </td>
                          <td data-label="Note" className="small">{s.note || <span className="muted">—</span>}</td>
                          <td data-label="Added" className="small">{formatDate(s.created_at)}</td>
                          <td>
                            <div className="row" style={{ flexWrap: 'nowrap' }}>
                              <Link to={`/candidates/${c.id}`} className="btn btn-sm">Profile</Link>
                              <button className="btn btn-sm btn-danger" disabled={removing === s.id} onClick={() => remove(s)}>
                                {removing === s.id ? 'Removing…' : 'Remove'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
