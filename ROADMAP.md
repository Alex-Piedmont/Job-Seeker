---
project: Job Seeker
created: 2026-04-01
last_synced: 2026-04-02
current_sprint: 4
services_doc: none
---

# Job Seeker Roadmap

Job Seeker is a personal career management platform for senior professionals actively job searching. It combines a kanban-style application tracker, AI-powered resume generation and review, and an automated job scraper that indexes corporate career sites across 100+ companies. The platform is deployed on Vercel with a Railway-hosted Postgres database.

## Sprints

| Sprint | Goal | Status | File |
|--------|------|--------|------|
| 1 | MVP Foundation: auth, resume builder, kanban, AI resume generation, analytics, admin | complete | sprints/sprint-1-complete.md |
| 2 | Feature Expansion: wizard, feedback, auto-save, docx preview, job scraper, Find Jobs UI | complete | sprints/sprint-2-complete.md |
| 3 | Scraper Reliability: ghosted tracking, Workday anti-403, cookie harvesting, throughput, ATS expansion | complete | sprints/sprint-3-complete.md |
| 4 | Coverage Expansion: Workday unresolved, Netflix Eightfold fallback, job dedup optimization, Taleo adapter | planned | sprints/sprint-4.md |
| 5 | New Adapter Development: Phenom People, TalentBrew/iCIMS, BrassRing | planned | sprints/sprint-5.md |

## Backlog

| ID | Feature | Priority | Refs | Dependencies |
|----|---------|----------|------|--------------|

## Icebox

| ID | Feature | Reason Deferred |
|----|---------|-----------------|
| F-29 | Avature Adapter (IBM, Delta, CBRE, Goldman Sachs) | Highly customized per-deployment; no public-facing job listing API confirmed; poor risk/reward ratio |
