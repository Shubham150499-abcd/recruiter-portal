import './jobs.css';

export function StatusBadge({ status }) {
  if (!status) return null;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`badge badge-${status}`}>{label}</span>;
}

export function expRange(min, max) {
  if (min == null && max == null) return '—';
  if (max == null) return `${min}+ yrs`;
  return `${min ?? 0}–${max} yrs`;
}

export function salaryRange(min, max) {
  const has = (v) => v !== null && v !== undefined && v !== '';
  if (!has(min) && !has(max)) return 'Not disclosed';
  if (!has(max)) return `${Number(min)}+ LPA`;
  if (!has(min)) return `Up to ${Number(max)} LPA`;
  return `${Number(min)}–${Number(max)} LPA`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return fmtDate(iso);
}

export function scoreClass(s) {
  return s >= 75 ? 'score-high' : s >= 50 ? 'score-mid' : 'score-low';
}

export function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

export function Loading({ lines = 3 }) {
  return (
    <div className="card" aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="jd-skel" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function ErrorAlert({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error row" role="alert">
      <span className="spacer">{error}</span>
      {onRetry && <button type="button" className="btn btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}

/** Close/Reopen + Delete helpers shared by list and detail pages. */
export function nextStatus(status) {
  return status === 'active' ? 'closed' : 'active';
}
export function statusActionLabel(status) {
  if (status === 'active') return 'Close job';
  if (status === 'draft') return 'Publish';
  return 'Reopen';
}
