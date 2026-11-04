// Thin fetch wrapper. Throws Error(message) on non-2xx using the API's {error} body.
async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function qs(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

// Format lakhs per annum, e.g. 12.5 -> "12.5 LPA"
export const lpa = (n) => (n === null || n === undefined || n === '' ? '—' : `${Number(n)} LPA`);
export const years = (n) => (n === null || n === undefined ? '—' : `${n} yr${Number(n) === 1 ? '' : 's'}`);
export const noticeLabel = (d) => (d === 0 ? 'Immediate' : `${d} days`);
