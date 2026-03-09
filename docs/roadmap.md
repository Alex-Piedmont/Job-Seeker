# Roadmap

## Scraper Optimization

### Skip unchanged job descriptions on re-scrape
**Priority:** Low | **Category:** API spend optimization

Currently, `upsertJobs` re-fetches and re-converts `jobDescriptionHtml` for every job on every scrape cycle, even when the listing hasn't changed. This is fine for correctness but wastes API calls and compute for companies with hundreds of stable postings.

**Proposed approach:**
- Store a hash (e.g. SHA-256) of `jobDescriptionHtml` alongside `jobDescriptionMd`
- On upsert, compare the incoming HTML hash to the stored hash
- Skip the `htmlToMarkdown` conversion and DB update if unchanged
- For Greenhouse specifically: explore using `updated_at` from the API response to skip unchanged jobs entirely (avoids fetching content at all)

**Tradeoffs:**
- Adds a column and comparison step per job
- Marginal savings per cycle unless company has 500+ listings
- Could defer content fetch entirely if the ATS API exposes a last-modified timestamp

**Context:** This came up when fixing entity-encoded HTML from Greenhouse (commit `008ff68`). The fix required a re-scrape of all Greenhouse jobs to regenerate markdown, which highlighted that we always overwrite even when nothing changed.
