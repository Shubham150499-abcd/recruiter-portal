import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { loadJobs } from './utils.js';
import './candidates.css';

/**
 * Shortlist action.
 * - With `jobId`: one-click shortlist to that job.
 * - Without: opens a small picker (job or "General" + optional note).
 * 409 (duplicate) is treated as "already shortlisted".
 */
export default function ShortlistButton({ candidateId, shortlisted = false, jobId, onShortlisted, size = 'sm' }) {
  const [done, setDone] = useState(shortlisted);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState(null);
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const ref = useRef(null);

  useEffect(() => setDone(shortlisted), [shortlisted]);

  useEffect(() => {
    if (!open) return;
    loadJobs().then((j) => setJobs(j.filter((x) => x.status !== 'closed'))).catch(() => setJobs([]));
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const submit = async (job_id, noteText) => {
    setBusy(true);
    setError('');
    try {
      const body = { candidate_id: Number(candidateId) };
      if (job_id) body.job_id = Number(job_id);
      if (noteText && noteText.trim()) body.note = noteText.trim();
      const res = await api.post('/shortlists', body);
      setDone(true);
      setOpen(false);
      setNote('');
      onShortlisted && onShortlisted(res);
    } catch (e) {
      if (/already|duplicate|exist|409/i.test(e.message)) {
        setDone(true);
        setOpen(false);
        setError('');
        onShortlisted && onShortlisted(null);
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const btnCls = `btn btn-${size}`;

  if (jobId) {
    return (
      <span className="cd-sl-wrap">
        <button className={`${btnCls} ${done ? 'cd-sl-done' : 'btn-primary'}`} disabled={busy || done} onClick={() => submit(jobId)}>
          {done ? '✓ Shortlisted' : busy ? 'Saving…' : 'Shortlist'}
        </button>
        {error && <span className="small cd-err-inline">{error}</span>}
      </span>
    );
  }

  return (
    <span className="cd-sl-wrap" ref={ref}>
      <button
        className={`${btnCls} ${done ? 'cd-sl-done' : 'btn-primary'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={done ? 'Shortlisted — click to add to another job' : 'Shortlist candidate'}
      >
        {done ? '✓ Shortlisted' : 'Shortlist'}
      </button>
      {open && (
        <div className="cd-popover" role="dialog" aria-label="Shortlist candidate">
          <div className="field">
            <label htmlFor={`sl-job-${candidateId}`}>Shortlist for</label>
            <select id={`sl-job-${candidateId}`} value={choice} onChange={(e) => setChoice(e.target.value)} disabled={!jobs}>
              <option value="">General (no job)</option>
              {(jobs || []).map((j) => (
                <option key={j.id} value={j.id}>{j.title}{j.status === 'draft' ? ' (draft)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`sl-note-${candidateId}`}>Note <span className="muted">(optional)</span></label>
            <textarea id={`sl-note-${candidateId}`} className="cd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strong React, call on Monday" />
          </div>
          {error && <div className="alert alert-error small">{error}</div>}
          <div className="row">
            <span className="spacer" />
            <button className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => submit(choice, note)}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </span>
  );
}
