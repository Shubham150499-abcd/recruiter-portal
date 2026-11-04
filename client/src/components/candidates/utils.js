import { api } from '../../api.js';

export function timeAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '—';
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const yrs = Math.floor(months / 12);
  return `${yrs} year${yrs === 1 ? '' : 's'} ago`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const scoreClass = (s) => (s >= 75 ? 'score-high' : s >= 50 ? 'score-mid' : 'score-low');

export const splitList = (s) =>
  (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

// Small in-memory caches so multiple components don't refetch /meta and /jobs.
let metaPromise = null;
export function loadMeta() {
  if (!metaPromise) metaPromise = api.get('/meta').catch((e) => { metaPromise = null; throw e; });
  return metaPromise;
}

let jobsPromise = null;
export function loadJobs(force = false) {
  if (!jobsPromise || force) jobsPromise = api.get('/jobs').catch((e) => { jobsPromise = null; throw e; });
  return jobsPromise;
}
