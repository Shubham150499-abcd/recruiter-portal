'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const cors = require('cors');
const { db, hydrate, hydrateAll, toJson } = require('./db');
const { scoreCandidate } = require('./matching');
const { compile, termRegex, QueryError } = require('./booleanQuery');

const RECRUITER_ID = 1;

// Auto-seed on first run
(function ensureSeeded() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM recruiters').get();
  if (!row || row.n === 0) {
    console.log('No recruiter found - seeding database...');
    require('./seed').seed();
  }
})();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);
const notFound = (what) => new HttpError(404, `${what} not found`);
const wrap = (fn) => (req, res, next) => {
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) {
    next(e);
  }
};

function parseId(v, what = 'id', status = 400) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(status, `Invalid ${what}`);
  return n;
}
function optNum(v, name) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw bad(`${name} must be a number`);
  return n;
}
function csv(v) {
  if (v === undefined || v === null || v === '') return [];
  const arr = Array.isArray(v) ? v : String(v).split(',');
  return arr.map((s) => String(s).trim()).filter(Boolean);
}
function strArray(v, name) {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return csv(v);
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw bad(`${name} must be an array of strings`);
  return [...new Set(v.map((s) => s.trim()).filter(Boolean))];
}
function pagination(pageRaw, sizeRaw) {
  let page = optNum(pageRaw, 'page') ?? 1;
  let page_size = optNum(sizeRaw, 'page_size') ?? 20;
  page = Math.max(1, Math.floor(page));
  page_size = Math.min(100, Math.max(1, Math.floor(page_size)));
  return { page, page_size };
}
const nowIso = () => new Date().toISOString();

// ---------- data access ----------
const q = {
  recruiter: db.prepare('SELECT * FROM recruiters WHERE id = ?'),
  job: db.prepare('SELECT * FROM jobs WHERE id = ? AND recruiter_id = ?'),
  allCandidates: db.prepare('SELECT * FROM candidates'),
  candidate: db.prepare('SELECT * FROM candidates WHERE id = ?'),
  shortlistedIds: db.prepare('SELECT DISTINCT candidate_id FROM shortlists WHERE recruiter_id = ?'),
  shortlistCountByJob: db.prepare('SELECT job_id, COUNT(*) AS n FROM shortlists WHERE recruiter_id = ? AND job_id IS NOT NULL GROUP BY job_id'),
};

function getRecruiter() {
  const r = hydrate('recruiters', q.recruiter.get(RECRUITER_ID));
  if (!r) throw notFound('Recruiter');
  return r;
}

function getJob(id) {
  const j = hydrate('jobs', q.job.get(id, RECRUITER_ID));
  if (!j) throw notFound('Job');
  return j;
}

function allCandidates() {
  return hydrateAll('candidates', q.allCandidates.all());
}

function shortlistedSet() {
  return new Set(q.shortlistedIds.all(RECRUITER_ID).map((r) => r.candidate_id));
}

function summarize(c, slSet) {
  const { resume_text, ...rest } = c;
  void resume_text;
  return { ...rest, is_shortlisted: slSet.has(c.id) };
}

function enrichJobs(jobs) {
  const cands = allCandidates();
  const slCounts = new Map(q.shortlistCountByJob.all(RECRUITER_ID).map((r) => [r.job_id, r.n]));
  return jobs.map((j) => ({
    ...j,
    // A candidate with no matching skills can still reach 50 from exp/location/salary/notice alone,
    // so only count candidates who also cover at least 40% of the job skills.
    match_count: cands.reduce((n, c) => {
      const m = scoreCandidate(j, c);
      return n + (m.score >= 50 && m.breakdown.skills >= 40 ? 1 : 0);
    }, 0),
    shortlist_count: slCounts.get(j.id) || 0,
  }));
}

// ---------- validation ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Internship'];
const WORK_MODES = ['Office', 'Remote', 'Hybrid'];
const STATUSES = ['active', 'closed', 'draft'];

const RECRUITER_FIELDS = ['name', 'email', 'phone', 'designation', 'company_name', 'company_website', 'company_size', 'industry', 'location', 'about', 'avatar_url', 'hiring_for'];

function validateRecruiter(body, existing) {
  const merged = { ...existing };
  for (const f of RECRUITER_FIELDS) {
    if (body[f] === undefined) continue;
    if (f === 'hiring_for') merged[f] = strArray(body[f], 'hiring_for');
    else {
      if (body[f] !== null && typeof body[f] !== 'string') throw bad(`${f} must be a string`);
      merged[f] = body[f] === null ? null : body[f].trim();
    }
  }
  if (!merged.name) throw bad('name is required');
  if (!merged.company_name) throw bad('company_name is required');
  if (!merged.email || !EMAIL_RE.test(merged.email)) throw bad('A valid email is required');
  return merged;
}

const JOB_FIELDS = ['title', 'description', 'skills', 'min_exp', 'max_exp', 'min_salary', 'max_salary', 'locations', 'employment_type', 'work_mode', 'education', 'industry', 'functional_area', 'openings', 'status'];

function validateJob(body, existing = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Request body must be a JSON object');
  const j = { ...existing };
  for (const f of JOB_FIELDS) if (body[f] !== undefined) j[f] = body[f];

  for (const f of ['title', 'description', 'education', 'industry', 'functional_area']) {
    if (j[f] != null && typeof j[f] !== 'string') throw bad(`${f} must be a string`);
    if (typeof j[f] === 'string') j[f] = j[f].trim();
  }
  if (!j.title) throw bad('title is required');
  if (!j.description) throw bad('description is required');
  j.skills = strArray(j.skills ?? [], 'skills');
  if (!j.skills.length) throw bad('skills must be a non-empty array');
  j.locations = strArray(j.locations ?? [], 'locations');
  if (!j.locations.length) throw bad('locations must be a non-empty array');

  const min = optNum(j.min_exp, 'min_exp');
  const max = optNum(j.max_exp, 'max_exp');
  if (min === undefined) throw bad('min_exp is required');
  if (max === undefined) throw bad('max_exp is required');
  if (min < 0 || max < 0) throw bad('Experience cannot be negative');
  if (min > max) throw bad('min_exp must be <= max_exp');
  j.min_exp = Math.round(min);
  j.max_exp = Math.round(max);

  const minS = optNum(j.min_salary, 'min_salary');
  const maxS = optNum(j.max_salary, 'max_salary');
  if ((minS !== undefined && minS < 0) || (maxS !== undefined && maxS < 0)) throw bad('Salary cannot be negative');
  if (minS !== undefined && maxS !== undefined && minS > maxS) throw bad('min_salary must be <= max_salary');
  j.min_salary = minS ?? null;
  j.max_salary = maxS ?? null;

  j.employment_type = j.employment_type || 'Full Time';
  if (!EMPLOYMENT_TYPES.includes(j.employment_type)) throw bad(`employment_type must be one of: ${EMPLOYMENT_TYPES.join(', ')}`);
  j.work_mode = j.work_mode || 'Office';
  if (!WORK_MODES.includes(j.work_mode)) throw bad(`work_mode must be one of: ${WORK_MODES.join(', ')}`);
  j.status = j.status || 'active';
  if (!STATUSES.includes(j.status)) throw bad(`status must be one of: ${STATUSES.join(', ')}`);
  const openings = optNum(j.openings, 'openings') ?? 1;
  if (!Number.isInteger(openings) || openings < 1) throw bad('openings must be a positive integer');
  j.openings = openings;
  return j;
}

// ---------- routes ----------
const api = express.Router();

api.get('/health', (req, res) => res.json({ ok: true }));

// Recruiter
api.get('/recruiter/me', wrap((req, res) => res.json(getRecruiter())));

api.put('/recruiter/me', wrap((req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw bad('Request body must be a JSON object');
  const merged = validateRecruiter(req.body, getRecruiter());
  db.prepare(
    `UPDATE recruiters SET name=?, email=?, phone=?, designation=?, company_name=?, company_website=?, company_size=?, industry=?, location=?, about=?, avatar_url=?, hiring_for=? WHERE id=?`
  ).run(merged.name, merged.email, merged.phone ?? null, merged.designation ?? null, merged.company_name, merged.company_website ?? null, merged.company_size ?? null, merged.industry ?? null, merged.location ?? null, merged.about ?? null, merged.avatar_url ?? null, toJson(merged.hiring_for), RECRUITER_ID);
  res.json(getRecruiter());
}));

// Dashboard
api.get('/dashboard', wrap((req, res) => {
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS n FROM jobs WHERE recruiter_id = ? GROUP BY status').all(RECRUITER_ID).map((r) => [r.status, r.n]));
  const total_candidates = db.prepare('SELECT COUNT(*) AS n FROM candidates').get().n;
  const shortlisted = db.prepare('SELECT COUNT(DISTINCT candidate_id) AS n FROM shortlists WHERE recruiter_id = ?').get(RECRUITER_ID).n;
  const recent = hydrateAll('jobs', db.prepare('SELECT * FROM jobs WHERE recruiter_id = ? ORDER BY created_at DESC, id DESC LIMIT 5').all(RECRUITER_ID));
  const skillCounts = new Map();
  for (const c of allCandidates()) for (const s of c.skills) skillCounts.set(s, (skillCounts.get(s) || 0) + 1);
  const top_skills = [...skillCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([skill, count]) => ({ skill, count }));
  res.json({
    active_jobs: counts.active || 0,
    closed_jobs: counts.closed || 0,
    draft_jobs: counts.draft || 0,
    total_candidates,
    shortlisted,
    recent_jobs: enrichJobs(recent),
    top_skills,
  });
}));

// Jobs
api.get('/jobs', wrap((req, res) => {
  const { status, q: text } = req.query;
  let sql = 'SELECT * FROM jobs WHERE recruiter_id = ?';
  const params = [RECRUITER_ID];
  if (status) {
    if (!STATUSES.includes(status)) throw bad(`status must be one of: ${STATUSES.join(', ')}`);
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC, id DESC';
  let jobs = hydrateAll('jobs', db.prepare(sql).all(...params));
  if (text && String(text).trim()) {
    const needle = String(text).trim().toLowerCase();
    jobs = jobs.filter((j) =>
      [j.title, j.description, j.industry, j.functional_area, ...j.skills, ...j.locations].some((v) => v && String(v).toLowerCase().includes(needle))
    );
  }
  res.json(enrichJobs(jobs));
}));

api.post('/jobs', wrap((req, res) => {
  const j = validateJob(req.body);
  const now = nowIso();
  const r = db.prepare(
    `INSERT INTO jobs (recruiter_id, title, description, skills, min_exp, max_exp, min_salary, max_salary, locations, employment_type, work_mode, education, industry, functional_area, openings, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(RECRUITER_ID, j.title, j.description, toJson(j.skills), j.min_exp, j.max_exp, j.min_salary, j.max_salary, toJson(j.locations), j.employment_type, j.work_mode, j.education ?? null, j.industry ?? null, j.functional_area ?? null, j.openings, j.status, now, now);
  res.status(201).json(getJob(Number(r.lastInsertRowid)));
}));

api.get('/jobs/:id', wrap((req, res) => res.json(enrichJobs([getJob(parseId(req.params.id, 'job id', 404))])[0])));

api.put('/jobs/:id', wrap((req, res) => {
  const id = parseId(req.params.id, 'job id', 404);
  const existing = getJob(id);
  const j = validateJob(req.body, existing);
  db.prepare(
    `UPDATE jobs SET title=?, description=?, skills=?, min_exp=?, max_exp=?, min_salary=?, max_salary=?, locations=?, employment_type=?, work_mode=?, education=?, industry=?, functional_area=?, openings=?, status=?, updated_at=? WHERE id=? AND recruiter_id=?`
  ).run(j.title, j.description, toJson(j.skills), j.min_exp, j.max_exp, j.min_salary, j.max_salary, toJson(j.locations), j.employment_type, j.work_mode, j.education ?? null, j.industry ?? null, j.functional_area ?? null, j.openings, j.status, nowIso(), id, RECRUITER_ID);
  res.json(getJob(id));
}));

api.patch('/jobs/:id/status', wrap((req, res) => {
  const id = parseId(req.params.id, 'job id', 404);
  getJob(id);
  const status = req.body && req.body.status;
  if (!STATUSES.includes(status)) throw bad(`status must be one of: ${STATUSES.join(', ')}`);
  db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE id=? AND recruiter_id=?').run(status, nowIso(), id, RECRUITER_ID);
  res.json(getJob(id));
}));

api.delete('/jobs/:id', wrap((req, res) => {
  const id = parseId(req.params.id, 'job id', 404);
  getJob(id);
  db.prepare('DELETE FROM jobs WHERE id=? AND recruiter_id=?').run(id, RECRUITER_ID);
  res.status(204).end();
}));

api.get('/jobs/:id/matches', wrap((req, res) => {
  const job = getJob(parseId(req.params.id, 'job id', 404));
  const minScore = optNum(req.query.min_score, 'min_score') ?? 0;
  let limit = optNum(req.query.limit, 'limit') ?? 50;
  limit = Math.max(1, Math.min(500, Math.floor(limit)));
  const sl = shortlistedSet();
  const results = allCandidates()
    .map((c) => ({ c, m: scoreCandidate(job, c) }))
    .filter((x) => x.m.score >= minScore)
    .sort((a, b) => b.m.score - a.m.score || b.m.breakdown.skills - a.m.breakdown.skills || String(b.c.last_active).localeCompare(String(a.c.last_active)))
    .slice(0, limit)
    .map(({ c, m }) => ({ candidate: summarize(c, sl), ...m }));
  res.json(results);
}));

// Candidate search
function candidateFieldsMatch(c, term) {
  // returns 0 (no match), 1 (text match) or weight for skills match
  const re = termRegex(term);
  const inSkills = c.skills.some((s) => s.toLowerCase() === term.toLowerCase() || re.test(s));
  const inTitle = re.test(c.current_title || '') || re.test(c.headline || '');
  const inResume = re.test(c.resume_text || '');
  return { any: inSkills || inTitle || inResume, score: (inSkills ? 3 : 0) + (inTitle ? 2 : 0) + (inResume ? 1 : 0) };
}

api.get('/candidates/search', wrap((req, res) => {
  const qp = req.query;
  const keywords = csv(qp.keywords);
  const anyKeywords = csv(qp.any_keywords);
  const exclude = csv(qp.exclude);
  const minExp = optNum(qp.min_exp, 'min_exp');
  const maxExp = optNum(qp.max_exp, 'max_exp');
  const minCtc = optNum(qp.min_ctc, 'min_ctc');
  const maxCtc = optNum(qp.max_ctc, 'max_ctc');
  const locations = csv(qp.locations).map((l) => l.toLowerCase());
  const noticeMax = optNum(qp.notice_max, 'notice_max');
  const activeWithin = optNum(qp.active_within, 'active_within');
  const company = qp.company ? String(qp.company).trim().toLowerCase() : '';
  const sort = qp.sort || 'relevance';
  if (!['relevance', 'experience', 'last_active', 'ctc'].includes(sort)) throw bad('sort must be one of: relevance, experience, last_active, ctc');
  if (minExp !== undefined && maxExp !== undefined && minExp > maxExp) throw bad('min_exp must be <= max_exp');
  if (minCtc !== undefined && maxCtc !== undefined && minCtc > maxCtc) throw bad('min_ctc must be <= max_ctc');
  const { page, page_size } = pagination(qp.page, qp.page_size);

  // SQL prefilter on numeric fields
  const where = [];
  const params = [];
  if (minExp !== undefined) { where.push('experience_years >= ?'); params.push(minExp); }
  if (maxExp !== undefined) { where.push('experience_years <= ?'); params.push(maxExp); }
  if (minCtc !== undefined) { where.push('current_ctc >= ?'); params.push(minCtc); }
  if (maxCtc !== undefined) { where.push('(current_ctc IS NULL OR current_ctc <= ?)'); params.push(maxCtc); }
  if (noticeMax !== undefined) { where.push('notice_period_days <= ?'); params.push(noticeMax); }
  if (activeWithin !== undefined) { where.push('last_active >= ?'); params.push(new Date(Date.now() - activeWithin * 86400000).toISOString()); }
  if (company) { where.push('LOWER(current_company) LIKE ?'); params.push(`%${company}%`); }
  const rows = hydrateAll('candidates', db.prepare(`SELECT * FROM candidates${where.length ? ' WHERE ' + where.join(' AND ') : ''}`).all(...params));

  const scored = [];
  for (const c of rows) {
    if (locations.length) {
      const locs = [c.location, ...c.preferred_locations].filter(Boolean).map((l) => l.toLowerCase());
      if (!locations.some((l) => locs.includes(l))) continue;
    }
    let relevance = 0;
    let ok = true;
    for (const k of keywords) {
      const m = candidateFieldsMatch(c, k);
      if (!m.any) { ok = false; break; }
      relevance += m.score;
    }
    if (!ok) continue;
    if (anyKeywords.length) {
      let hit = false;
      for (const k of anyKeywords) {
        const m = candidateFieldsMatch(c, k);
        if (m.any) { hit = true; relevance += m.score; }
      }
      if (!hit) continue;
    }
    if (exclude.some((k) => candidateFieldsMatch(c, k).any)) continue;
    scored.push({ c, relevance });
  }

  const byActive = (a, b) => String(b.c.last_active).localeCompare(String(a.c.last_active));
  const sorters = {
    relevance: (a, b) => b.relevance - a.relevance || byActive(a, b),
    experience: (a, b) => b.c.experience_years - a.c.experience_years || byActive(a, b),
    last_active: byActive,
    ctc: (a, b) => (b.c.current_ctc ?? -1) - (a.c.current_ctc ?? -1) || byActive(a, b),
  };
  scored.sort(sorters[sort]);
  const sl = shortlistedSet();
  const start = (page - 1) * page_size;
  res.json({
    total: scored.length,
    page,
    page_size,
    results: scored.slice(start, start + page_size).map(({ c }) => summarize(c, sl)),
  });
}));

api.get('/candidates/:id', wrap((req, res) => {
  const id = parseId(req.params.id, 'candidate id', 404);
  const c = hydrate('candidates', q.candidate.get(id));
  if (!c) throw notFound('Candidate');
  const shortlists = db
    .prepare(
      `SELECT s.id, s.job_id, j.title AS job_title, s.note FROM shortlists s LEFT JOIN jobs j ON j.id = s.job_id
       WHERE s.candidate_id = ? AND s.recruiter_id = ? ORDER BY s.created_at DESC`
    )
    .all(id, RECRUITER_ID)
    .map((r) => ({ ...r }));
  res.json({ ...c, shortlists });
}));

api.get('/candidates/:id/matching-jobs', wrap((req, res) => {
  const id = parseId(req.params.id, 'candidate id', 404);
  const c = hydrate('candidates', q.candidate.get(id));
  if (!c) throw notFound('Candidate');
  const jobs = hydrateAll('jobs', db.prepare("SELECT * FROM jobs WHERE recruiter_id = ? AND status = 'active'").all(RECRUITER_ID));
  const out = jobs.map((job) => ({ job, ...scoreCandidate(job, c) })).sort((a, b) => b.score - a.score);
  res.json(out);
}));

// Resume search
api.post('/resumes/search', wrap((req, res) => {
  const body = req.body || {};
  if (typeof body.query !== 'string') throw bad('query is required');
  const compiled = compile(body.query); // throws QueryError (400)
  const { page, page_size } = pagination(body.page, body.page_size);
  const minExp = optNum(body.min_exp, 'min_exp');
  const maxExp = optNum(body.max_exp, 'max_exp');
  const locations = (strArray(body.locations, 'locations') || []).map((l) => l.toLowerCase());

  const matches = [];
  for (const c of allCandidates()) {
    if (minExp !== undefined && c.experience_years < minExp) continue;
    if (maxExp !== undefined && c.experience_years > maxExp) continue;
    if (locations.length) {
      const locs = [c.location, ...c.preferred_locations].filter(Boolean).map((l) => l.toLowerCase());
      if (!locations.some((l) => locs.includes(l))) continue;
    }
    if (!compiled.test(c.resume_text)) continue;
    const hitList = compiled.findHits(c.resume_text);
    matches.push({ c, hitList });
  }
  matches.sort((a, b) => b.hitList.length - a.hitList.length || String(b.c.last_active).localeCompare(String(a.c.last_active)));
  const sl = shortlistedSet();
  const start = (page - 1) * page_size;
  res.json({
    total: matches.length,
    page,
    page_size,
    results: matches.slice(start, start + page_size).map(({ c, hitList }) => ({
      candidate: summarize(c, sl),
      hits: hitList.length,
      snippets: compiled.snippets(c.resume_text),
    })),
  });
}));

// Shortlists
api.get('/shortlists', wrap((req, res) => {
  let sql = `SELECT s.id, s.job_id, j.title AS job_title, s.note, s.created_at, s.candidate_id
             FROM shortlists s LEFT JOIN jobs j ON j.id = s.job_id WHERE s.recruiter_id = ?`;
  const params = [RECRUITER_ID];
  if (req.query.job_id !== undefined && req.query.job_id !== '') {
    sql += ' AND s.job_id = ?';
    params.push(parseId(req.query.job_id, 'job_id'));
  }
  sql += ' ORDER BY s.created_at DESC, s.id DESC';
  const rows = db.prepare(sql).all(...params);
  const sl = shortlistedSet();
  res.json(
    rows.map((r) => {
      const c = hydrate('candidates', q.candidate.get(r.candidate_id));
      return { id: r.id, job_id: r.job_id, job_title: r.job_title, note: r.note, created_at: r.created_at, candidate: c ? summarize(c, sl) : null };
    })
  );
}));

api.post('/shortlists', wrap((req, res) => {
  const body = req.body || {};
  const candidateId = parseId(body.candidate_id, 'candidate_id');
  if (!q.candidate.get(candidateId)) throw notFound('Candidate');
  let jobId = null;
  if (body.job_id !== undefined && body.job_id !== null && body.job_id !== '') {
    jobId = parseId(body.job_id, 'job_id');
    getJob(jobId);
  }
  if (body.note != null && typeof body.note !== 'string') throw bad('note must be a string');
  const dup = db
    .prepare('SELECT id FROM shortlists WHERE recruiter_id = ? AND candidate_id = ? AND IFNULL(job_id, 0) = ?')
    .get(RECRUITER_ID, candidateId, jobId ?? 0);
  if (dup) throw new HttpError(409, jobId ? 'Candidate is already shortlisted for this job' : 'Candidate is already shortlisted');
  const r = db
    .prepare('INSERT INTO shortlists (recruiter_id, job_id, candidate_id, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(RECRUITER_ID, jobId, candidateId, body.note ? body.note.trim() : '', nowIso());
  const row = db
    .prepare('SELECT s.id, s.recruiter_id, s.job_id, j.title AS job_title, s.candidate_id, s.note, s.created_at FROM shortlists s LEFT JOIN jobs j ON j.id = s.job_id WHERE s.id = ?')
    .get(Number(r.lastInsertRowid));
  const c = hydrate('candidates', q.candidate.get(candidateId));
  res.status(201).json({ ...row, candidate: summarize(c, shortlistedSet()) });
}));

api.delete('/shortlists/:id', wrap((req, res) => {
  const id = parseId(req.params.id, 'shortlist id', 404);
  const r = db.prepare('DELETE FROM shortlists WHERE id = ? AND recruiter_id = ?').run(id, RECRUITER_ID);
  if (!r.changes) throw notFound('Shortlist');
  res.status(204).end();
}));

// Meta
const BASE_INDUSTRIES = ['IT Services & Consulting', 'Software Product', 'FinTech / Payments', 'E-commerce', 'BFSI', 'Healthcare', 'EdTech', 'Telecom', 'Manufacturing', 'Retail', 'Logistics', 'Media & Entertainment'];
const BASE_FUNCTIONAL_AREAS = ['Engineering - Software & QA', 'Data Science & Analytics', 'IT & Information Security', 'Product Management', 'UX, Design & Architecture', 'Human Resources', 'Sales & Business Development', 'Marketing & Communication', 'Finance & Accounting', 'Customer Success & Operations'];
const BASE_EDUCATION = ['B.Tech/B.E.', 'M.Tech', 'MCA', 'BCA', 'B.Sc', 'M.Sc', 'MBA/PGDM', 'B.Com', 'BBA', 'M.A.', 'Any Graduate', 'Any Postgraduate'];
const BASE_LOCATIONS = ['Bengaluru', 'Pune', 'Hyderabad', 'Mumbai', 'Delhi NCR', 'Chennai', 'Noida', 'Gurugram', 'Kolkata', 'Ahmedabad', 'Remote'];

api.get('/meta', wrap((req, res) => {
  const skills = new Set();
  const locations = new Set(BASE_LOCATIONS);
  const industries = new Set(BASE_INDUSTRIES);
  const fas = new Set(BASE_FUNCTIONAL_AREAS);
  const education = new Set(BASE_EDUCATION);
  for (const c of allCandidates()) {
    c.skills.forEach((s) => skills.add(s));
    if (c.location) locations.add(c.location);
    c.preferred_locations.forEach((l) => locations.add(l));
  }
  for (const j of hydrateAll('jobs', db.prepare('SELECT * FROM jobs WHERE recruiter_id = ?').all(RECRUITER_ID))) {
    j.skills.forEach((s) => skills.add(s));
    j.locations.forEach((l) => locations.add(l));
    if (j.industry) industries.add(j.industry);
    if (j.functional_area) fas.add(j.functional_area);
    if (j.education) education.add(j.education);
  }
  const sorted = (s) => [...s].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  res.json({
    skills: sorted(skills),
    locations: [...BASE_LOCATIONS, ...sorted([...locations].filter((l) => !BASE_LOCATIONS.includes(l)))],
    industries: sorted(industries),
    functional_areas: sorted(fas),
    education: [...BASE_EDUCATION, ...sorted([...education].filter((e) => !BASE_EDUCATION.includes(e)))],
  });
}));

api.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` }));

app.use('/api', api);

// Serve built client if present
const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof QueryError) return res.status(400).json({ error: `Invalid query: ${err.message}` });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

const PORT = Number(process.env.PORT) || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`TalentDesk API listening on http://localhost:${PORT}`));
}

module.exports = app;
