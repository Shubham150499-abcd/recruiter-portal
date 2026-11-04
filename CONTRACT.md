# TalentDesk — recruiter portal (Naukri recruiter-side style)

Shared contract for everyone working on this repo. Do not change it without updating this file.

## Stack
- Node 24 (uses built-in `node:sqlite`, no native deps), Express 4, CommonJS in `server/`.
- React 18 + react-router-dom 6 + Vite 5 in `client/` (ESM, `.jsx`). Plain CSS (`client/src/styles.css`), no UI library.
- API on port **4000**, Vite dev server on **5173** proxies `/api` → 4000.
- Run: `npm install` (root), `npm run seed`, `npm run dev` (starts both).
- Brand name: **TalentDesk**. Do not use Naukri's name or logo in the UI.
- No auth: the logged-in recruiter is always `id = 1` (seeded).

## Data model (SQLite, file `server/data.db`)
JSON arrays are stored as TEXT and returned to clients as real arrays.

- `recruiters`: id, name, email, phone, designation, company_name, company_website, company_size, industry, location, about, avatar_url, hiring_for (JSON array of role strings), created_at
- `jobs`: id, recruiter_id, title, description, skills (JSON), min_exp, max_exp (years, int), min_salary, max_salary (lakhs per annum, number), locations (JSON), employment_type ('Full Time'|'Part Time'|'Contract'|'Internship'), work_mode ('Office'|'Remote'|'Hybrid'), education, industry, functional_area, openings (int), status ('active'|'closed'|'draft'), created_at, updated_at
- `candidates`: id, name, email, phone, headline, current_title, current_company, location, preferred_locations (JSON), experience_years (number), current_ctc, expected_ctc (LPA), notice_period_days (int: 0,15,30,60,90), skills (JSON), education, resume_text (multi-paragraph plain text resume), gender, last_active (ISO date), created_at
- `shortlists`: id, recruiter_id, job_id (nullable), candidate_id, note, created_at. Unique (recruiter_id, job_id, candidate_id).

## REST API (all JSON, prefix `/api`)
Errors: `{ "error": "message" }` with 4xx/5xx.

### Recruiter profile
- `GET /recruiter/me` → recruiter object
- `PUT /recruiter/me` body: any editable recruiter fields → updated recruiter. Validate email format and required `name`, `company_name`.

### Dashboard
- `GET /dashboard` → `{ active_jobs, closed_jobs, draft_jobs, total_candidates, shortlisted, recent_jobs: [job (with match_count)], top_skills: [{skill, count}] }`

### Jobs
- `GET /jobs?status=active|closed|draft&q=text` → `[job]` each with `match_count` (candidates scoring >= 50 and skills breakdown >= 40) and `shortlist_count`
- `POST /jobs` → created job (201). Required: title, description, skills (non-empty), min_exp <= max_exp, locations (non-empty). Default status 'active'.
- `GET /jobs/:id` → job
- `PUT /jobs/:id` → updated job
- `PATCH /jobs/:id/status` body `{status}` → updated job
- `DELETE /jobs/:id` → 204

### Candidate search (Resdex-style structured search)
- `GET /candidates/search` query params (all optional):
  - `keywords` comma-separated, ALL must match (in skills, title, headline or resume_text, case-insensitive)
  - `any_keywords` comma-separated, at least one must match
  - `exclude` comma-separated, none may match
  - `min_exp`, `max_exp`, `min_ctc`, `max_ctc`
  - `locations` comma-separated (matches current location OR preferred_locations)
  - `notice_max` (days)
  - `active_within` (days since last_active)
  - `company` substring of current_company
  - `sort` = `relevance` (default) | `experience` | `last_active` | `ctc`
  - `page` (1-based, default 1), `page_size` (default 20, max 100)
  - → `{ total, page, page_size, results: [candidateSummary] }`
- `candidateSummary` = candidate without `resume_text`, plus `is_shortlisted` (bool, any job).
- `GET /candidates/:id` → full candidate incl. `resume_text` and `shortlists: [{id, job_id, job_title, note}]`
- `GET /candidates/:id/matching-jobs` → `[{ job, score, breakdown, matched_skills, missing_skills }]` for recruiter's active jobs, sorted by score desc.

### Resume search (boolean full-text over resume_text)
- `POST /resumes/search` body `{ query, page?, page_size?, min_exp?, max_exp?, locations? }`
  - query grammar: terms, `"quoted phrases"`, `AND`, `OR`, `NOT`, parentheses. Adjacent terms default to AND. Case-insensitive. Example: `"machine learning" AND (python OR R) NOT intern`
  - → `{ total, page, page_size, results: [{ candidate: candidateSummary, hits: n, snippets: [string] }] }`
  - snippets: up to 3 excerpts (~160 chars) with matched terms wrapped in `<mark>…</mark>`; all other text HTML-escaped.
  - invalid query → 400 `{error}`.

### Candidate matching
- `GET /jobs/:id/matches?min_score=0&limit=50` → `[{ candidate: candidateSummary, score, breakdown, matched_skills, missing_skills }]` sorted by score desc
- `score` 0–100 integer. `breakdown` = `{ skills, experience, location, salary, notice }` each 0–100, weighted 50/20/15/10/5.
  - skills: share of job skills found in candidate skills (case-insensitive; also count a skill found in resume_text at half weight)
  - experience: 100 inside [min_exp, max_exp]; decays 20 pts per year outside
  - location: 100 if current location or preferred_locations matches a job location, 100 for Remote jobs, else 0
  - salary: 100 if expected_ctc <= max_salary; decays 10 pts per lakh above
  - notice: 0→100, 15→100, 30→80, 60→50, 90→20

### Shortlists
- `GET /shortlists?job_id=` → `[{ id, job_id, job_title, note, created_at, candidate: candidateSummary }]`
- `POST /shortlists` body `{ candidate_id, job_id?, note? }` → 201 shortlist (409 if duplicate)
- `DELETE /shortlists/:id` → 204

### Meta (autocomplete)
- `GET /meta` → `{ skills: [string], locations: [string], industries: [string], functional_areas: [string], education: [string] }`

## Frontend ownership (avoid editing each other's files)
- Shared, already written — edit only if strictly needed: `client/src/main.jsx`, `client/src/App.jsx`, `client/src/api.js`, `client/src/styles.css`, `client/src/components/Layout.jsx`.
- Agent "recruiter & jobs": `pages/Dashboard.jsx`, `pages/Profile.jsx`, `pages/Jobs.jsx`, `pages/JobForm.jsx`, `pages/JobDetail.jsx`, `components/jobs/*`.
- Agent "search & matching": `pages/CandidateSearch.jsx`, `pages/ResumeSearch.jsx`, `pages/CandidateDetail.jsx`, `pages/JobMatches.jsx`, `pages/Shortlists.jsx`, `components/candidates/*`.
- Agent "backend": everything in `server/`.

## Routes (defined in App.jsx)
`/` Dashboard · `/profile` · `/jobs` · `/jobs/new` · `/jobs/:id` · `/jobs/:id/edit` · `/jobs/:id/matches` · `/search` (candidate search) · `/resume-search` · `/candidates/:id` · `/shortlists`
