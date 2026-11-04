'use strict';
const { termRegex } = require('./booleanQuery');

const WEIGHTS = { skills: 50, experience: 20, location: 15, salary: 10, notice: 5 };

/** Canonical form for skill comparison: "React.js" == "ReactJS" == "react". */
function canonSkill(s) {
  let c = String(s || '').toLowerCase().trim().replace(/[\s.\-_]+/g, '');
  if (c.length > 4 && c.endsWith('js') && c !== 'nodejs') c = c.slice(0, -2);
  if (c === 'node') c = 'nodejs';
  return c;
}

const CITY_ALIASES = { bangalore: 'bengaluru', gurgaon: 'gurugram', bombay: 'mumbai', 'new delhi': 'delhi ncr', delhi: 'delhi ncr', calcutta: 'kolkata', madras: 'chennai' };
function canonCity(c) {
  const k = String(c || '').toLowerCase().trim();
  return CITY_ALIASES[k] || k;
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

function skillsScore(job, cand) {
  const jobSkills = job.skills || [];
  if (!jobSkills.length) return { value: 100, matched: [], missing: [] };
  const candSet = new Set((cand.skills || []).map(canonSkill));
  const resume = cand.resume_text || '';
  let pts = 0;
  const matched = [];
  const missing = [];
  for (const s of jobSkills) {
    if (candSet.has(canonSkill(s))) {
      pts += 1;
      matched.push(s);
    } else if (resume && termRegex(s).test(resume)) {
      pts += 0.5;
      matched.push(s);
    } else {
      missing.push(s);
    }
  }
  return { value: (100 * pts) / jobSkills.length, matched, missing };
}

function experienceScore(job, cand) {
  const exp = Number(cand.experience_years) || 0;
  const min = Number(job.min_exp) || 0;
  const max = job.max_exp == null ? Infinity : Number(job.max_exp);
  if (exp >= min && exp <= max) return 100;
  const dist = exp < min ? min - exp : exp - max;
  return clamp(100 - 20 * dist);
}

function locationScore(job, cand) {
  const jobLocs = (job.locations || []).map(canonCity);
  if (job.work_mode === 'Remote' || jobLocs.includes('remote')) return 100;
  const candLocs = [cand.location, ...(cand.preferred_locations || [])].map(canonCity);
  return candLocs.some((c) => c && jobLocs.includes(c)) ? 100 : 0;
}

function salaryScore(job, cand) {
  const max = job.max_salary;
  const exp = cand.expected_ctc;
  if (max == null || max === '' || exp == null) return 100;
  if (Number(exp) <= Number(max)) return 100;
  return clamp(100 - 10 * (Number(exp) - Number(max)));
}

const NOTICE_POINTS = [[0, 100], [15, 100], [30, 80], [60, 50], [90, 20]];
function noticeScore(cand) {
  const d = Number(cand.notice_period_days) || 0;
  if (d <= 0) return 100;
  for (let i = 1; i < NOTICE_POINTS.length; i++) {
    const [d1, v1] = NOTICE_POINTS[i];
    if (d <= d1) {
      const [d0, v0] = NOTICE_POINTS[i - 1];
      return v0 + ((v1 - v0) * (d - d0)) / (d1 - d0);
    }
  }
  return 20;
}

/**
 * Score a candidate against a job.
 * @returns {{score:number, breakdown:{skills,experience,location,salary,notice}, matched_skills:string[], missing_skills:string[]}}
 */
function scoreCandidate(job, cand) {
  const sk = skillsScore(job, cand);
  const raw = {
    skills: sk.value,
    experience: experienceScore(job, cand),
    location: locationScore(job, cand),
    salary: salaryScore(job, cand),
    notice: noticeScore(cand),
  };
  let total = 0;
  for (const k of Object.keys(WEIGHTS)) total += (raw[k] * WEIGHTS[k]) / 100;
  const breakdown = {};
  for (const k of Object.keys(WEIGHTS)) breakdown[k] = Math.round(raw[k]);
  return { score: Math.round(total), breakdown, matched_skills: sk.matched, missing_skills: sk.missing };
}

module.exports = { scoreCandidate, canonSkill, canonCity, WEIGHTS };
