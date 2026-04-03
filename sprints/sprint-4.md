---
sprint: 4
goal: Coverage Expansion — Workday unresolved companies, Netflix Eightfold fallback, job description dedup optimization, Oracle Taleo adapter
status: planned
started: --
completed: --
---

# Sprint 4: Coverage Expansion

| ID | Feature | Status | Shipped | Refs | Dependencies |
|----|---------|--------|---------|------|--------------|
| F-24 | Workday Unresolved Companies (BNY Mellon, Nordstrom, Waste Management) | not-started | -- | tasks/ats-import-unresolved.md | F-20 |
| F-26 | Netflix Eightfold Fallback (sitemap+JSON-LD) | not-started | -- | docs/roadmap.md | F-22 |
| F-27 | Skip Unchanged Job Descriptions (scraper optimization) | not-started | -- | docs/roadmap.md | -- |
| F-25 | Oracle Taleo Adapter (8 companies) | not-started | -- | docs/roadmap.md | -- |

## Notes

Sprint 4 focuses on closing out known coverage gaps with well-scoped work. F-24 is config/probe only (no adapter code). F-26 extends the existing Eightfold adapter. F-27 is a standalone optimization to reduce redundant HTML-to-markdown conversions and API spend. F-25 introduces a new Taleo adapter against standardized *.taleo.net URL patterns.
