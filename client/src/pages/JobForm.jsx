import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import TagInput from '../components/jobs/TagInput.jsx';
import { Loading, ErrorAlert, StatusBadge } from '../components/jobs/common.jsx';
import '../components/jobs/jobs.css';

const EXP_OPTIONS = Array.from({ length: 31 }, (_, i) => i);
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Internship'];
const WORK_MODES = ['Office', 'Remote', 'Hybrid'];

const EMPTY = {
  title: '',
  description: '',
  skills: [],
  min_exp: 0,
  max_exp: 3,
  min_salary: '',
  max_salary: '',
  locations: [],
  employment_type: 'Full Time',
  work_mode: 'Office',
  education: '',
  industry: '',
  functional_area: '',
  openings: 1,
};

function fromJob(j) {
  const f = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) {
    if (j[k] !== undefined && j[k] !== null) f[k] = j[k];
  }
  f.skills = Array.isArray(j.skills) ? j.skills : [];
  f.locations = Array.isArray(j.locations) ? j.locations : [];
  return f;
}

function validate(f) {
  const e = {};
  if (!f.title.trim()) e.title = 'Job title is required';
  else if (f.title.trim().length < 3) e.title = 'Job title is too short';
  if (!f.description.trim()) e.description = 'Job description is required';
  else if (f.description.trim().length < 30) e.description = 'Please write at least 30 characters so candidates understand the role';
  if (!f.skills.length) e.skills = 'Add at least one key skill';
  if (!f.locations.length) e.locations = 'Add at least one job location';
  if (Number(f.min_exp) > Number(f.max_exp)) e.max_exp = 'Max experience must be ≥ min experience';
  const minS = f.min_salary === '' ? null : Number(f.min_salary);
  const maxS = f.max_salary === '' ? null : Number(f.max_salary);
  if (minS !== null && (Number.isNaN(minS) || minS < 0)) e.min_salary = 'Enter a valid amount';
  if (maxS !== null && (Number.isNaN(maxS) || maxS < 0)) e.max_salary = 'Enter a valid amount';
  if (!e.min_salary && !e.max_salary && minS !== null && maxS !== null && minS > maxS) e.max_salary = 'Max salary must be ≥ min salary';
  const op = Number(f.openings);
  if (!Number.isInteger(op) || op < 1) e.openings = 'At least 1 opening';
  return e;
}

function toBody(f, status) {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    skills: f.skills,
    min_exp: Number(f.min_exp),
    max_exp: Number(f.max_exp),
    min_salary: f.min_salary === '' ? null : Number(f.min_salary),
    max_salary: f.max_salary === '' ? null : Number(f.max_salary),
    locations: f.locations,
    employment_type: f.employment_type,
    work_mode: f.work_mode,
    education: f.education || null,
    industry: f.industry.trim() || null,
    functional_area: f.functional_area.trim() || null,
    openings: Number(f.openings),
    status,
  };
}

function Field({ label, name, required, error, hint, full, children }) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={name}>{label}{required && <span className="req">*</span>}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error" id={`${name}-err`}>{error}</span>}
    </div>
  );
}

export default function JobForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [job, setJob] = useState(null);
  const [meta, setMeta] = useState({ skills: [], locations: [], industries: [], functional_areas: [], education: [] });
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(null); // status being saved

  useEffect(() => {
    api.get('/meta').then((m) => setMeta((prev) => ({ ...prev, ...m }))).catch(() => {});
  }, []);

  const loadJob = useCallback(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError('');
    api.get(`/jobs/${id}`)
      .then((j) => { setJob(j); setForm(fromJob(j)); })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    if (isEdit) loadJob();
    else { setJob(null); setForm(EMPTY); setErrors({}); setLoading(false); }
  }, [isEdit, loadJob]);

  const set = (k) => (e) => {
    const v = e && e.target ? e.target.value : e;
    setForm((f) => ({ ...f, [k]: v }));
    // Clear this field's error, plus the paired max_* error when its min_* changes.
    const linked = { min_exp: 'max_exp', min_salary: 'max_salary' }[k];
    setErrors((er) => {
      if (!er[k] && !(linked && er[linked])) return er;
      const next = { ...er, [k]: undefined };
      if (linked) next[linked] = undefined;
      return next;
    });
  };

  async function save(status) {
    const errs = validate(form);
    setErrors(errs);
    setSubmitError('');
    if (Object.keys(errs).length) {
      setSubmitError('Please fix the highlighted fields before saving.');
      const first = document.querySelector('.field .error');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(status);
    try {
      const body = toBody(form, status);
      const saved = isEdit ? await api.put(`/jobs/${id}`, body) : await api.post('/jobs', body);
      navigate(`/jobs/${saved?.id ?? id}`, { state: { flash: isEdit ? 'Job updated successfully.' : status === 'draft' ? 'Job saved as draft.' : 'Job published successfully.' } });
    } catch (e) {
      setSubmitError(e.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <Loading lines={6} />;
  if (loadError) {
    return (
      <div>
        <ErrorAlert error={`Could not load job: ${loadError}`} onRetry={loadJob} />
        <Link to="/jobs" className="btn">← Back to jobs</Link>
      </div>
    );
  }

  const educationOptions = meta.education?.length ? meta.education : [];
  const busy = saving !== null;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link to={isEdit ? `/jobs/${id}` : '/jobs'} className="small">← {isEdit ? 'Back to job' : 'Back to jobs'}</Link>
          <h1 style={{ marginTop: 4 }}>{isEdit ? 'Edit job' : 'Post a new job'}</h1>
          {isEdit && job && <div className="row small muted">Current status: <StatusBadge status={job.status} /></div>}
        </div>
      </div>

      {submitError && <div className="alert alert-error" role="alert">{submitError}</div>}

      <form noValidate onSubmit={(e) => { e.preventDefault(); save('active'); }}>
        <div className="card jd-form-section">
          <h2>Job details</h2>
          <div className="jd-form-grid">
            <Field label="Job title / designation" name="title" required error={errors.title} full>
              <input id="title" className={errors.title ? 'invalid' : ''} value={form.title} onChange={set('title')} placeholder="e.g. Senior React Developer" maxLength={120} />
            </Field>
            <Field label="Job description" name="description" required error={errors.description} full hint={`${form.description.length} characters — describe responsibilities, requirements and benefits`}>
              <textarea id="description" className={errors.description ? 'invalid' : ''} value={form.description} onChange={set('description')} style={{ minHeight: 180 }} maxLength={8000} />
            </Field>
            <Field label="Key skills" name="skills" required error={errors.skills} full hint="Type to see suggestions. Press Enter or comma to add.">
              <TagInput id="skills" value={form.skills} onChange={set('skills')} suggestions={meta.skills || []} invalid={!!errors.skills} placeholder="e.g. React, Node.js" max={30} />
            </Field>
          </div>
        </div>

        <div className="card jd-form-section">
          <h2>Experience, salary &amp; location</h2>
          <div className="jd-form-grid">
            <Field label="Min experience (years)" name="min_exp" required error={errors.min_exp}>
              <select id="min_exp" value={form.min_exp} onChange={set('min_exp')}>
                {EXP_OPTIONS.map((n) => <option key={n} value={n}>{n} {n === 1 ? 'year' : 'years'}</option>)}
              </select>
            </Field>
            <Field label="Max experience (years)" name="max_exp" required error={errors.max_exp}>
              <select id="max_exp" className={errors.max_exp ? 'invalid' : ''} value={form.max_exp} onChange={set('max_exp')}>
                {EXP_OPTIONS.map((n) => <option key={n} value={n}>{n} {n === 1 ? 'year' : 'years'}</option>)}
              </select>
            </Field>
            <Field label="Min salary (LPA)" name="min_salary" error={errors.min_salary} hint="Lakhs per annum, optional">
              <input id="min_salary" type="number" min="0" step="0.5" inputMode="decimal" className={errors.min_salary ? 'invalid' : ''} value={form.min_salary} onChange={set('min_salary')} placeholder="e.g. 8" />
            </Field>
            <Field label="Max salary (LPA)" name="max_salary" error={errors.max_salary} hint="Lakhs per annum, optional">
              <input id="max_salary" type="number" min="0" step="0.5" inputMode="decimal" className={errors.max_salary ? 'invalid' : ''} value={form.max_salary} onChange={set('max_salary')} placeholder="e.g. 15" />
            </Field>
            <Field label="Job locations" name="locations" required error={errors.locations} full hint="Add one or more cities (or Remote)">
              <TagInput id="locations" value={form.locations} onChange={set('locations')} suggestions={meta.locations || []} invalid={!!errors.locations} placeholder="e.g. Bengaluru" max={15} />
            </Field>
            <Field label="Employment type" name="employment_type">
              <select id="employment_type" value={form.employment_type} onChange={set('employment_type')}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Work mode" name="work_mode">
              <select id="work_mode" value={form.work_mode} onChange={set('work_mode')}>
                {WORK_MODES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="card jd-form-section">
          <h2>Additional details</h2>
          <div className="jd-form-grid">
            <Field label="Education" name="education">
              <select id="education" value={form.education} onChange={set('education')}>
                <option value="">Any</option>
                {educationOptions.map((e) => <option key={e}>{e}</option>)}
                {form.education && !educationOptions.includes(form.education) && <option>{form.education}</option>}
              </select>
            </Field>
            <Field label="Number of openings" name="openings" required error={errors.openings}>
              <input id="openings" type="number" min="1" step="1" className={errors.openings ? 'invalid' : ''} value={form.openings} onChange={set('openings')} />
            </Field>
            <Field label="Industry" name="industry">
              <input id="industry" list="jd-industries" value={form.industry} onChange={set('industry')} placeholder="e.g. IT Services & Consulting" />
              <datalist id="jd-industries">{(meta.industries || []).map((i) => <option key={i} value={i} />)}</datalist>
            </Field>
            <Field label="Functional area / department" name="functional_area">
              <input id="functional_area" list="jd-fareas" value={form.functional_area} onChange={set('functional_area')} placeholder="e.g. Engineering - Software" />
              <datalist id="jd-fareas">{(meta.functional_areas || []).map((i) => <option key={i} value={i} />)}</datalist>
            </Field>
          </div>

          <div className="jd-form-actions">
            <Link to={isEdit ? `/jobs/${id}` : '/jobs'} className="btn btn-ghost">Cancel</Link>
            <button type="button" className="btn" disabled={busy} onClick={() => save('draft')}>
              {saving === 'draft' ? 'Saving…' : 'Save as draft'}
            </button>
            {isEdit && job?.status === 'closed' && (
              <button type="button" className="btn" disabled={busy} onClick={() => save('closed')}>
                {saving === 'closed' ? 'Saving…' : 'Save (keep closed)'}
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {saving === 'active' ? 'Publishing…' : isEdit && job?.status === 'active' ? 'Update job' : 'Publish job'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
