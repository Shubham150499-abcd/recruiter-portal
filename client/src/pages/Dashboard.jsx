import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { StatusBadge, expRange, Loading, ErrorAlert, timeAgo } from '../components/jobs/common.jsx';
import '../components/jobs/jobs.css';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    // Profile failing shouldn't block the dashboard.
    api.get('/recruiter/me').then(setMe).catch(() => setMe(null));
    api.get('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const firstName = me?.name ? me.name.split(' ')[0] : '';
  const stats = data
    ? [
        { label: 'Active jobs', value: data.active_jobs, to: '/jobs?status=active', accent: true },
        { label: 'Draft jobs', value: data.draft_jobs, to: '/jobs?status=draft' },
        { label: 'Closed jobs', value: data.closed_jobs, to: '/jobs?status=closed' },
        { label: 'Candidates in talent pool', value: data.total_candidates, to: '/search' },
        { label: 'Shortlisted', value: data.shortlisted, to: '/shortlists' },
      ]
    : [];
  const topSkills = data?.top_skills || [];
  const maxSkill = Math.max(1, ...topSkills.map((s) => s.count));

  return (
    <div className="stack">
      <div className="card jd-hero">
        <div>
          <h1>{greeting()}{firstName ? `, ${firstName}` : ''}!</h1>
          <div className="muted">
            {me ? <>{me.designation ? `${me.designation} · ` : ''}{me.company_name || 'Your company'}</> : 'Welcome to TalentDesk'}
          </div>
        </div>
        <div className="row">
          <Link to="/jobs/new" className="btn btn-primary">+ Post a job</Link>
          <Link to="/search" className="btn">Search candidates</Link>
          <Link to="/resume-search" className="btn">Resume search</Link>
        </div>
      </div>

      <ErrorAlert error={error} onRetry={load} />

      {loading && !data ? (
        <div className="grid grid-4">
          {[0, 1, 2, 3].map((i) => <Loading key={i} lines={2} />)}
        </div>
      ) : data ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {stats.map((s) => (
            <Link key={s.label} to={s.to} className={`card jd-stat-card${s.accent ? ' accent' : ''}`} style={{ marginTop: 0, textDecoration: 'none' }}>
              <span className="stat-label">{s.label}</span>
              <span className="stat">{s.value ?? 0}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {data && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }} data-resp="dash">
          <div className="card" style={{ marginTop: 0 }}>
            <div className="jd-section-title">
              <h2>Recent jobs</h2>
              <Link to="/jobs" className="small">View all jobs →</Link>
            </div>
            {(data.recent_jobs || []).length === 0 ? (
              <div className="empty">
                <p>You haven't posted any jobs yet.</p>
                <Link to="/jobs/new" className="btn btn-primary">Post your first job</Link>
              </div>
            ) : (
              <ul className="jd-list">
                {data.recent_jobs.map((j) => (
                  <li key={j.id} className="jd-job-row">
                    <div className="jd-job-main">
                      <div className="row">
                        <Link to={`/jobs/${j.id}`} className="jd-job-title">{j.title}</Link>
                        <StatusBadge status={j.status} />
                      </div>
                      <div className="jd-meta">
                        <span>{expRange(j.min_exp, j.max_exp)}</span>
                        <span>{(j.locations || []).join(', ') || '—'}</span>
                        <span>{timeAgo(j.created_at)}</span>
                      </div>
                    </div>
                    <Link to={`/jobs/${j.id}/matches`} className="btn btn-sm">
                      <strong>{j.match_count ?? 0}</strong> matching candidates
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card" style={{ marginTop: 0 }}>
            <div className="jd-section-title">
              <h2>Top skills in talent pool</h2>
            </div>
            {topSkills.length === 0 ? (
              <div className="empty">No skill data yet.</div>
            ) : (
              topSkills.slice(0, 10).map((s) => (
                <div className="jd-skill-bar" key={s.skill}>
                  <Link to={`/search?keywords=${encodeURIComponent(s.skill)}`} title={`Search candidates with ${s.skill}`}>{s.skill}</Link>
                  <div className="bar"><span style={{ width: `${(s.count / maxSkill) * 100}%` }} /></div>
                  <span className="muted small" style={{ textAlign: 'right' }}>{s.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
