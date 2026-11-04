# TalentDesk Recruiter

A recruiter portal modeled on Naukri.com's recruiter side: recruiter profile, job posting, candidate search, boolean resume search and candidate–job matching. Built on React, Vite, Express and the SQLite engine built into Node.

## Run
```
npm install
npm run seed      # resets server/data.db with demo data (1 recruiter, 8 jobs, 150 candidates)
npm run dev       # API on :4000, app on http://localhost:5173
```
Production-style: `npm run build && npm start` and open http://localhost:4000.

Requires Node 24+ (uses `node:sqlite`).

## Features
| Feature | Where |
|---|---|
| Recruiter profile (edit, validation, completeness meter) | `/profile` |
| Job posting (create/edit, draft/publish, close/reopen, delete) | `/jobs`, `/jobs/new`, `/jobs/:id` |
| Candidate search (keywords all/any/exclude, exp, CTC, location, notice, activity, company, sort) | `/search` |
| Resume search (`"phrases"`, AND/OR/NOT, parentheses, highlighted snippets) | `/resume-search` |
| Candidate matching (weighted score, breakdown, matched/missing skills, compare up to 3) | `/jobs/:id/matches`, `/candidates/:id` |
| Shortlists by job | `/shortlists` |

The API contract is in `CONTRACT.md`. Matching weights: skills 50, experience 20, location 15, salary 10, notice period 5.
