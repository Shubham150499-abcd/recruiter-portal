import { Link } from 'react-router-dom';
import { lpa, years, noticeLabel } from '../../api.js';
import { timeAgo } from './utils.js';
import ShortlistButton from './ShortlistButton.jsx';
import './candidates.css';

/** Highlight skills that match any of the given keywords (case-insensitive substring either way). */
export function skillMatches(skill, keywords) {
  const s = skill.toLowerCase();
  return keywords.some((k) => {
    const kk = k.toLowerCase();
    return kk && (s === kk || s.includes(kk) || kk.includes(s));
  });
}

export default function CandidateCard({ candidate: c, keywords = [], children, aside, showShortlist = true }) {
  const initials = (c.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <article className="card cd-card">
      <div className="cd-card-main">
        <div className="cd-avatar" aria-hidden="true">{initials}</div>
        <div className="cd-card-body">
          <div className="cd-card-top">
            <div>
              <Link to={`/candidates/${c.id}`} className="cd-name">{c.name}</Link>
              {c.headline && <div className="cd-headline">{c.headline}</div>}
            </div>
            <div className="cd-card-actions">
              {aside}
              {showShortlist && <ShortlistButton candidateId={c.id} shortlisted={!!c.is_shortlisted} />}
            </div>
          </div>
          {(c.current_title || c.current_company) && (
            <div className="cd-current">
              {c.current_title}{c.current_company ? <> <span className="muted">@</span> {c.current_company}</> : null}
            </div>
          )}
          <ul className="cd-facts">
            <li title="Experience">💼 {years(c.experience_years)}</li>
            <li title="Current / expected CTC">₹ {lpa(c.current_ctc)} <span className="muted">→ {lpa(c.expected_ctc)}</span></li>
            <li title="Location">📍 {c.location || '—'}</li>
            <li title="Notice period">⏱ {c.notice_period_days === null || c.notice_period_days === undefined ? '—' : noticeLabel(c.notice_period_days)}</li>
          </ul>
          {c.skills?.length > 0 && (
            <div className="cd-skills">
              {c.skills.map((s) => (
                <span key={s} className={`chip ${keywords.length && skillMatches(s, keywords) ? 'chip-match' : ''}`}>{s}</span>
              ))}
            </div>
          )}
          {children}
          <div className="cd-meta small muted">
            <span className={activeClass(c.last_active)}>● </span>Active {timeAgo(c.last_active)}
            {c.education && <> · {c.education}</>}
          </div>
        </div>
      </div>
    </article>
  );
}

function activeClass(iso) {
  if (!iso) return 'cd-dot-old';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  return d <= 7 ? 'cd-dot-fresh' : d <= 30 ? 'cd-dot-mid' : 'cd-dot-old';
}
