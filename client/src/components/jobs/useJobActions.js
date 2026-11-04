import { useState } from 'react';
import { api } from '../../api.js';
import { nextStatus } from './common.jsx';

/**
 * Shared close/reopen/publish + delete actions for a job.
 * onUpdated(updatedJob) / onDeleted(job) callbacks let pages refresh their state.
 */
export default function useJobActions({ onUpdated, onDeleted, onError } = {}) {
  const [busyId, setBusyId] = useState(null);

  async function toggleStatus(job) {
    const status = nextStatus(job.status);
    if (status === 'closed' && !window.confirm(`Close "${job.title}"? It will stop appearing as an active job.`)) return;
    setBusyId(job.id);
    try {
      const updated = await api.patch(`/jobs/${job.id}/status`, { status });
      onUpdated?.(updated || { ...job, status });
    } catch (e) {
      onError?.(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(job) {
    if (!window.confirm(`Delete "${job.title}" permanently? This cannot be undone.`)) return;
    setBusyId(job.id);
    try {
      await api.del(`/jobs/${job.id}`);
      onDeleted?.(job);
    } catch (e) {
      onError?.(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, toggleStatus, remove };
}
