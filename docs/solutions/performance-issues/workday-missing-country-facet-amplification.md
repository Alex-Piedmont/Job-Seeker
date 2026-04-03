---
title: Workday missing country facet causes 100x detail fetch amplification
category: performance-issues
date: 2026-04-01
tags: [workday, scraper, performance, country-facet, detail-fetch, rate-limiting, cron]
related-files: [scraper/src/adapters/workday.ts, scraper/src/utils/location-filter.ts, scraper/src/config.ts]
supersedes: null
---

## Problem

The scraper cron job was taking 7+ hours (target: under 2 hours). The single longest company was PwC at 2 hours 6 minutes -- yet it only yielded 68 US jobs. Meanwhile, companies with 3,000+ US jobs (RTX, Northrop Grumman) completed in under 2 hours.

The surface metric (wall time) suggested PwC was slow due to rate limiting. The actual cause was far more insidious: PwC's Workday instance does not expose a US country facet in its CXS probe response, so the adapter fetched detail pages for every single global job posting (10,000+), then filtered to US at the detail level. With a 500ms global rate limiter, this meant 10,000+ sequential HTTP requests just to find 68 US jobs.

## Investigation

1. **Checked Railway logs** for the noon cron run: `railway logs --service scraper --lines 5000 --filter "Scrape complete"`. Sorted by `durationMs` to find the slowest companies.

2. **PwC stood out**: 7,562,589ms (2h6m) for 68 jobs. The next slowest (RTX at 6,313,186ms) had 3,026 jobs -- proportional to its volume. PwC's ratio was wildly off.

3. **Checked for the "country facet not found" warning**: `railway logs --filter "country facet not found"` revealed PwC, Thermo Fisher Scientific, Sysco, TJX, and T. Rowe Price all lacked the US country facet.

4. **Counted wasted detail fetches**: `grep 'PwC' | grep 'Skipping non-US' | wc -l` returned 1,787 non-US detail fetches that were individually requested and discarded. The actual total was likely much higher (many were outside the 5,000 log line window).

5. **Key insight**: The `locationsText` field (e.g. "London, England", "Mumbai, India") was available on every list-level posting but was completely ignored. The adapter only used the detail-level `country.id` for US filtering.

## Root Cause

The Workday CXS API exposes country filtering via "facets" in the probe response. The adapter auto-discovers the US country facet and applies it as `appliedFacets[locationCountry] = [US_ID]`. However, some Workday tenants (PwC, Thermo Fisher, Sysco) do not include a country facet in their probe response. When this happens, the adapter falls back to scraping ALL jobs globally and checking each job's country at the detail level.

This creates a multiplicative amplification: a company with 10,000 global jobs but only 68 US jobs generates ~10,000 detail requests (one per job) instead of ~68. At a 500ms rate limit, that is ~83 minutes of pure wait time wasted on non-US jobs.

The amplification was hidden because:
- The "country facet not found" warning was logged but not surfaced in any dashboard
- The overall cron time was dominated by these few companies, but the per-company breakdown was not routinely monitored
- The `durationMs` metric showed high times but did not distinguish "slow because many jobs" from "slow because wasted requests"

## Solution

Four changes deployed together (commits a98283c through 9046c0f):

**1. List-level US pre-filter (highest impact):**
Added `isLikelyUSLocation()` that checks the `locationsText` field from the CXS list response before making detail requests. Jobs with clearly non-US locations (e.g. "London, England", "Mumbai, India") are skipped without a detail fetch. Jobs with empty/null/ambiguous locations or "Remote" are kept (inclusive default). This eliminates ~70-80% of wasted detail fetches for no-facet companies.

**2. Per-host rate limiting at 300ms:**
Changed the Workday rate limiter from a single global 500ms gate (all tenants serialized) to per-host at 300ms. Different Workday tenants (e.g. `pwc.wd1` vs `raytheon.wd5`) can now make requests concurrently. The global limiter was over-conservative because it was set when 403s were misattributed to rate limiting (see related learning).

**3. Page size 20 (Workday hard limit):**
The CXS API enforces a hard limit of 20 results per page. An earlier attempt to increase to 100 caused HTTP 400 across all 76 Workday companies (see `docs/solutions/integration-issues/workday-cxs-page-size-limit.md`). Reverted in commit `90f0c0e`.

**4. Max jobs cap (5,000) for no-facet companies:**
Hard ceiling prevents any single company from paginating through more than 5,000 global jobs. Combined with the pre-filter, this bounds worst-case time.

## Prevention

- [ ] When adding scraper adapters that filter at the detail level, always check whether the list response contains enough data to pre-filter. If a field like `locationsText` is available, use it.
- [ ] Monitor per-company `durationMs` relative to `jobsFound` after each cron run. A high ratio (e.g. >1 minute per 10 jobs found) indicates wasted work.
- [ ] When a facet/filter is "optional" (some tenants expose it, some don't), always implement a fallback filter strategy at the list level, not just at the detail level.
- [ ] Log a metric like "detail fetches per US job found" to detect amplification early. A ratio >5:1 warrants investigation.
