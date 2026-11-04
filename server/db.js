'use strict';
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS recruiters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  designation TEXT,
  company_name TEXT NOT NULL,
  company_website TEXT,
  company_size TEXT,
  industry TEXT,
  location TEXT,
  about TEXT,
  avatar_url TEXT,
  hiring_for TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skills TEXT NOT NULL DEFAULT '[]',
  min_exp INTEGER NOT NULL DEFAULT 0,
  max_exp INTEGER NOT NULL DEFAULT 0,
  min_salary REAL,
  max_salary REAL,
  locations TEXT NOT NULL DEFAULT '[]',
  employment_type TEXT NOT NULL DEFAULT 'Full Time',
  work_mode TEXT NOT NULL DEFAULT 'Office',
  education TEXT,
  industry TEXT,
  functional_area TEXT,
  openings INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  headline TEXT,
  current_title TEXT,
  current_company TEXT,
  location TEXT,
  preferred_locations TEXT NOT NULL DEFAULT '[]',
  experience_years REAL NOT NULL DEFAULT 0,
  current_ctc REAL,
  expected_ctc REAL,
  notice_period_days INTEGER NOT NULL DEFAULT 30,
  skills TEXT NOT NULL DEFAULT '[]',
  education TEXT,
  resume_text TEXT NOT NULL DEFAULT '',
  gender TEXT,
  last_active TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS shortlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shortlists ON shortlists(recruiter_id, IFNULL(job_id, 0), candidate_id);
CREATE INDEX IF NOT EXISTS ix_jobs_recruiter ON jobs(recruiter_id, status);
CREATE INDEX IF NOT EXISTS ix_shortlists_candidate ON shortlists(candidate_id);
`;

function init() {
  db.exec(SCHEMA);
}

function dropAll() {
  db.exec(`
    DROP TABLE IF EXISTS shortlists;
    DROP TABLE IF EXISTS jobs;
    DROP TABLE IF EXISTS candidates;
    DROP TABLE IF EXISTS recruiters;
  `);
}

const JSON_COLS = {
  recruiters: ['hiring_for'],
  jobs: ['skills', 'locations'],
  candidates: ['preferred_locations', 'skills'],
  shortlists: [],
};

function parseJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '') return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function toJson(v) {
  return JSON.stringify(Array.isArray(v) ? v : []);
}

/** Convert a raw row from `table` into an API object (JSON columns parsed, null-prototype removed). */
function hydrate(table, row) {
  if (!row) return null;
  const out = { ...row };
  for (const col of JSON_COLS[table] || []) out[col] = parseJsonArray(out[col]);
  return out;
}

function hydrateAll(table, rows) {
  return rows.map((r) => hydrate(table, r));
}

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

init();

module.exports = { db, init, dropAll, hydrate, hydrateAll, parseJsonArray, toJson, transaction, JSON_COLS, DB_PATH };
