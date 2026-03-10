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

## New ATS Adapters

### Phenom People adapter
**Priority:** Medium | **Category:** Scraper coverage

Needed for: **Snowflake** (`https://careers.snowflake.com/us/en`) — migrated off Greenhouse.

Phenom serves as both a CMS and ATS layer with its own widget-based API (`/widgets` endpoints, `ph-` prefixed components). Requires research into their API structure for paginated job listing and detail fetching.

### SmartRecruiters adapter
**Priority:** Medium | **Category:** Scraper coverage

Needed for: **Visa** (`https://careers.smartrecruiters.com/visa`).

SmartRecruiters has a public Job Search API (`https://api.smartrecruiters.com/v1/companies/{id}/postings`). Should be straightforward to implement.

### Avature adapter
**Priority:** Low | **Category:** Scraper coverage

Needed for: **IBM** (`https://careers.ibm.com`; login portal at `ibmglobal.avature.net`).

Avature is a highly customized CRM/ATS. IBM's implementation may be heavily custom-branded, making a generic adapter difficult. Needs research into whether a public-facing job listing API exists.

### TalentBrew (iCIMS) adapter
**Priority:** Low | **Category:** Scraper coverage

Needed for: **Intuit** (`https://jobs.intuit.com`).

TalentBrew is an iCIMS career site product (employer branding layer on top of iCIMS ATS). Uses its own CDN (`tbcdn.talentbrew.com`) and URL conventions distinct from the Jibe-powered iCIMS sites the existing adapter supports. May need a separate adapter or an extension to the existing iCIMS adapter.

## New Companies (Existing Adapters)

### Charles Schwab
**ATS:** iCIMS (existing adapter) | **URL:** `https://www.schwabjobs.com` | Backend: `career-schwab.icims.com`

Note: Schwab's site uses iCIMS but routes through `schwabjobs.com` rather than a Jibe-powered domain. Verify whether the existing iCIMS/Jibe adapter works or if a different iCIMS integration path is needed.
