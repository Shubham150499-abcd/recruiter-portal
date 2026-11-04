import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import TagInput from '../components/jobs/TagInput.jsx';
import { Loading, ErrorAlert, initials } from '../components/jobs/common.jsx';
import '../components/jobs/jobs.css';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fields counted toward profile completeness, with friendly labels.
const COMPLETENESS_FIELDS = [
  ['name', 'Full name'],
  ['email', 'Email'],
  ['phone', 'Phone number'],
  ['designation', 'Designation'],
  ['company_name', 'Company name'],
  ['company_website', 'Company website'],
  ['company_size', 'Company size'],
  ['industry', 'Industry'],
  ['location', 'Location'],
  ['about', 'About'],
  ['hiring_for', 'Roles you hire for'],
];

const EDITABLE = ['name', 'email', 'phone', 'designation', 'company_name', 'company_website', 'company_size', 'industry', 'location', 'about', 'hiring_for', 'avatar_url'];

function filled(v) {
  return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== '';
}

function toForm(r) {
  const f = {};
  for (const k of EDITABLE) f[k] = k === 'hiring_for' ? (Array.isArray(r?.[k]) ? r[k] : []) : r?.[k] ?? '';
  return f;
}

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'Name is required';
  if (!f.company_name.trim()) e.company_name = 'Company name is required';
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address';
  if (f.phone.trim() && !/^\+?[\d\s()-]{7,}$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number';
  if (f.company_website.trim() && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(f.company_website.trim())) e.company_website = 'Enter a valid URL';
  return e;
}

function Completeness({ data }) {
  const done = COMPLETENESS_FIELDS.filter(([k]) => filled(data[k]));
  const pct = Math.round((done.length / COMPLETENESS_FIELDS.length) * 100);
  const missing = COMPLETENESS_FIELDS.filter(([k]) => !filled(data[k]));
  const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <h3>Profile completeness</h3>
      <div className="row">
        <span className="stat" style={{ color }}>{pct}%</span>
        <span className="muted small">{done.length}/{COMPLETENESS_FIELDS.length} fields</span>
      </div>
      <div className="jd-meter" role="progressbar" aria-label="Profile completeness" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
      {missing.length ? (
        <>
          <div className="small muted">Complete your profile to build trust with candidates:</div>
          <ul className="jd-missing">{missing.map(([k, l]) => <li key={k}>Add {l.toLowerCase()}</li>)}</ul>
        </>
      ) : (
        <div className="small" style={{ color: 'var(--success)' }}>Your profile is complete. Great job!</div>
      )}
    </div>
  );
}

function Field({ label, name, required, error, children, hint, full }) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={name}>{label}{required && <span className="req">*</span>}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

const NotAdded = () => <span className="muted">Not added</span>;

export default function Profile() {
  const [recruiter, setRecruiter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(toForm(null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null); // {type, msg}

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    api.get('/recruiter/me')
      .then((r) => { setRecruiter(r); setForm(toForm(r)); })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => {
    const v = e && e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setAlert({ type: 'error', msg: 'Please fix the highlighted fields.' });
      return;
    }
    setSaving(true);
    setAlert(null);
    try {
      const body = { ...form };
      for (const k of Object.keys(body)) if (typeof body[k] === 'string') body[k] = body[k].trim();
      const updated = await api.put('/recruiter/me', body);
      setRecruiter(updated);
      setForm(toForm(updated));
      setEditing(false);
      setAlert({ type: 'success', msg: 'Profile updated successfully.' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.message });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setForm(toForm(recruiter));
    setErrors({});
    setAlert(null);
    setEditing(false);
  }

  if (loading) return <Loading lines={5} />;
  if (loadError) return <ErrorAlert error={`Could not load profile: ${loadError}`} onRetry={load} />;
  if (!recruiter) return <div className="card empty">Profile not found.</div>;

  const r = recruiter;
  const shown = editing ? form : toForm(r);
  const website = r.company_website && (/^https?:\/\//i.test(r.company_website) ? r.company_website : `https://${r.company_website}`);

  return (
    <div>
      <div className="page-header">
        <h1>Recruiter profile</h1>
        {!editing && (
          <button className="btn btn-primary" onClick={() => { setAlert(null); setForm(toForm(r)); setEditing(true); }}>
            Edit profile
          </button>
        )}
      </div>
      {alert && <div className={`alert alert-${alert.type}`} role={alert.type === 'error' ? 'alert' : 'status'}>{alert.msg}</div>}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px', alignItems: 'start' }} data-resp="detail">
        <div>
          <div className="card">
            <div className="jd-profile-head">
              <div className="jd-avatar" aria-hidden="true">
                {shown.avatar_url
                  ? <img src={shown.avatar_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : initials(shown.name)}
              </div>
              <div>
                <h2 style={{ marginBottom: 2 }}>{shown.name || 'Your name'}</h2>
                <div className="muted">{[shown.designation, shown.company_name].filter(Boolean).join(' at ') || '—'}</div>
                {shown.location && <div className="muted small">{shown.location}</div>}
              </div>
            </div>
          </div>

          {!editing ? (
            <>
              <div className="card">
                <h3>Contact &amp; role</h3>
                <dl className="jd-dl">
                  <dt>Email</dt><dd>{r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : <NotAdded />}</dd>
                  <dt>Phone</dt><dd>{r.phone || <NotAdded />}</dd>
                  <dt>Designation</dt><dd>{r.designation || <NotAdded />}</dd>
                  <dt>Location</dt><dd>{r.location || <NotAdded />}</dd>
                </dl>
              </div>
              <div className="card">
                <h3>Company</h3>
                <dl className="jd-dl">
                  <dt>Company</dt><dd>{r.company_name || <NotAdded />}</dd>
                  <dt>Website</dt><dd>{website ? <a href={website} target="_blank" rel="noreferrer">{r.company_website}</a> : <NotAdded />}</dd>
                  <dt>Company size</dt><dd>{r.company_size ? `${r.company_size} employees` : <NotAdded />}</dd>
                  <dt>Industry</dt><dd>{r.industry || <NotAdded />}</dd>
                </dl>
              </div>
              <div className="card">
                <h3>About</h3>
                {r.about
                  ? <p className="jd-desc" style={{ margin: 0 }}>{r.about}</p>
                  : <p className="muted" style={{ margin: 0 }}>Tell candidates about your company and hiring culture.</p>}
              </div>
              <div className="card">
                <h3>Hiring for</h3>
                {(r.hiring_for || []).length
                  ? <div className="row">{r.hiring_for.map((h) => <span key={h} className="chip">{h}</span>)}</div>
                  : <p className="muted" style={{ margin: 0 }}>No roles added.</p>}
              </div>
            </>
          ) : (
            <form className="card" onSubmit={onSubmit} noValidate>
              <h3>Personal details</h3>
              <div className="jd-form-grid">
                <Field label="Full name" name="name" required error={errors.name}>
                  <input id="name" className={errors.name ? 'invalid' : ''} value={form.name} onChange={set('name')} maxLength={100} />
                </Field>
                <Field label="Designation" name="designation">
                  <input id="designation" value={form.designation} onChange={set('designation')} placeholder="e.g. Talent Acquisition Lead" />
                </Field>
                <Field label="Email" name="email" error={errors.email}>
                  <input id="email" type="email" className={errors.email ? 'invalid' : ''} value={form.email} onChange={set('email')} />
                </Field>
                <Field label="Phone" name="phone" error={errors.phone}>
                  <input id="phone" type="tel" className={errors.phone ? 'invalid' : ''} value={form.phone} onChange={set('phone')} />
                </Field>
                <Field label="Location" name="location">
                  <input id="location" value={form.location} onChange={set('location')} placeholder="e.g. Bengaluru" />
                </Field>
                <Field label="Avatar image URL" name="avatar_url" hint="Optional — initials are shown if empty">
                  <input id="avatar_url" value={form.avatar_url} onChange={set('avatar_url')} />
                </Field>
              </div>
              <div className="divider" />
              <h3>Company details</h3>
              <div className="jd-form-grid">
                <Field label="Company name" name="company_name" required error={errors.company_name}>
                  <input id="company_name" className={errors.company_name ? 'invalid' : ''} value={form.company_name} onChange={set('company_name')} />
                </Field>
                <Field label="Company website" name="company_website" error={errors.company_website}>
                  <input id="company_website" className={errors.company_website ? 'invalid' : ''} value={form.company_website} onChange={set('company_website')} placeholder="https://example.com" />
                </Field>
                <Field label="Company size" name="company_size">
                  <select id="company_size" value={form.company_size} onChange={set('company_size')}>
                    <option value="">Select size</option>
                    {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                    {form.company_size && !COMPANY_SIZES.includes(form.company_size) && <option value={form.company_size}>{form.company_size}</option>}
                  </select>
                </Field>
                <Field label="Industry" name="industry">
                  <input id="industry" value={form.industry} onChange={set('industry')} placeholder="e.g. IT Services" />
                </Field>
                <Field label="About" name="about" full>
                  <textarea id="about" value={form.about} onChange={set('about')} maxLength={2000} />
                </Field>
                <Field label="Hiring for" name="hiring_for" full hint="Roles you typically hire for — press Enter or comma to add">
                  <TagInput id="hiring_for" value={form.hiring_for} onChange={set('hiring_for')} placeholder="e.g. Backend Engineer" />
                </Field>
              </div>
              <div className="jd-form-actions">
                <button type="button" className="btn" onClick={cancel} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
              </div>
            </form>
          )}
        </div>
        <Completeness data={shown} />
      </div>
    </div>
  );
}
