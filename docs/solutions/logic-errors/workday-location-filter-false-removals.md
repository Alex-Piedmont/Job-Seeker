---
title: Redundant location pre-filter caused mass false job removals on Workday
category: logic-errors
date: 2026-04-02
tags: [workday, scraper, location-filter, detectRemovals, seenExternalIds, false-removal, isLikelyUSLocation]
related-files: [scraper/src/adapters/workday.ts, scraper/src/services/job-store.ts, scraper/src/utils/location-filter.ts]
---

## Problem

Warner Bros Discovery (and likely many other Workday companies) had 57% of US jobs incorrectly marked as removed every scrape run. WBD's website listed 208 US jobs; the scraper captured only 87 and marked the rest as removed. The removed count (342 in 7 days) far exceeded the active count (87), and scrape logs showed wild churn: 199 added, 212 removed in a single run.

## Investigation

1. Probed the WBD Workday CXS API directly -- confirmed 203 US full-time jobs exist
2. Queried production DB -- only 87 active, 342 removed in last 7 days
3. Scrape logs showed the count dropped from ~200 (healthy Apr 1 run) to 87 (Apr 2 run)
4. Extracted all 203 location text values from the API and ran them through `isLikelyUSLocation()`
5. Found 117 of 206 unique job locations FAILED the filter -- exact match to the 116 removed in the Apr 2 scrape

Key diagnostic: comparing API-reported totals against `jobsFound` in scrape logs immediately revealed the adapter was silently dropping jobs.

## Root Cause

Two interacting bugs:

**1. Redundant filter applied unconditionally.** The Workday adapter had three filtering layers:
- L1: API-level `locationCountry` facet (server-side, when discoverable)
- L2: `isLikelyUSLocation(locationsText)` list-level pre-filter
- L3: Detail-level `info.country.id` check

L2 was added in Sprint 3 as a performance optimization for companies WITHOUT a country facet (PwC: 10,000+ global jobs, 2h6m runtime). But it was applied unconditionally -- even when L1 already guaranteed US-only results. When L1 is active, L2 adds zero value and can only subtract legitimate jobs.

**2. Location text format mismatch.** Workday uses non-standard location formats that `isUSLocation()` couldn't parse:
- `"CA Burbank Bldg. 700, Second Century, Tower 1"` -- state abbreviation at START of string (regex only checked after comma or at end)
- `"2 Locations"`, `"3 Locations"` -- multi-location markers treated as non-US
- `"N/A"` -- placeholder treated as non-US

**3. Removal amplification.** Jobs filtered by L2 never entered `seenExternalIds` in `upsertJobs()`. Then `detectRemovals()` marked them as removed because they were "not seen." A filtering bug became a data integrity bug -- every scrape run removed legitimate jobs, and the existing guard (`seenExternalIds.length === 0`) only caught total failures, not partial data loss.

## Solution

Three changes (commit `161f953`):

1. **Gate L2 behind `!hasCountryFacet`** (`workday.ts`): When the API-level country facet is active, skip the location text pre-filter entirely. The `hasCountryFacet` boolean already existed.

2. **Proportional removal guard** (`job-store.ts`): Before executing removal UPDATE, check if `seenExternalIds.length < previousActiveCount * 0.5`. If so, skip removals and log a warning. This catches the entire class of "partial data masquerading as complete scrape" bugs (WAF 403s, adapter bugs, filter issues).

3. **Improved location regex** (`location-filter.ts`): Added state-first pattern (`/^([A-Z]{2})\s/`) to `isUSLocation()`. Added "N Locations" and "N/A" handling to `isLikelyUSLocation()`. This improves correctness for no-facet companies where L2 is still needed.

## Prevention

- [ ] When adding a filter that reduces the set of jobs returned by an adapter, verify that filtered-out jobs don't trigger `detectRemovals`. The adapter return value directly controls `seenExternalIds`.
- [ ] Performance optimizations that skip work (like L2 skipping detail fetches) must be gated behind the condition that makes them necessary. If the condition is absent, the optimization is pure risk.
- [ ] When investigating job count discrepancies: probe the ATS API directly to get the ground-truth total, then compare against `jobsFound` in scrape logs. The gap between API total and `jobsFound` immediately reveals adapter-level filtering.
- [ ] Any new guard in `detectRemovals` should check proportionality, not just emptiness. The existing `length === 0` guard missed partial data loss affecting 57% of jobs.
