# Job Seeker — Implementation Tracker

## New ATS Adapters: Oracle HCM Cloud + SAP SuccessFactors

### Overview

Add two new ATS platform adapters following the existing pattern. Both are batch scrapers (like iCIMS/Greenhouse) — no streaming needed.

**Touchpoints for each adapter** (6 files):
1. `scraper/src/adapters/<platform>.ts` — Full adapter class
2. `scraper/src/adapters/registry.ts` — Register in adapter map
3. `src/lib/scraper/adapters.ts` — Lightweight Next.js port
4. `src/lib/scraper/scrape-company.ts` — Add to `batchScrapers` map
5. `prisma/schema.prisma` — Add to `AtsPlatform` enum
6. `src/lib/validations/scraper.ts` — Add to `atsPlatformValues`

Then one migration + `prisma generate`.

---

### Adapter 1: Oracle HCM Cloud (ORACLE)

**API:** `GET /hcmRestApi/resources/11.13.18.05/recruitingICEJobRequisitions`
- Public JSON REST endpoint (same API the career site SPA calls)
- Pagination via `limit` + `offset`, response includes `hasMore` + `totalResults`
- Supports `finder=findReqs` with params: `keyword`, `workLocationCountryCode`, `workplaceType`, etc.

**Base URL format:** `https://{instance}.fa.{region}.oraclecloud.com/hcmUI/CandidateExperience/en/sites/{siteId}`
- Example: `https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch`
- Need to parse: instance host + siteId from the URL

**API URL construction:**
- List: `https://{host}/hcmRestApi/resources/11.13.18.05/recruitingICEJobRequisitions?finder=findReqs;siteNumber={siteId};workLocationCountryCode=US&limit=25&offset=0`
- The `siteNumber` parameter links to the career site's siteId

**Field mapping to ScrapedJobData:**
| Oracle field | → | ScrapedJobData field |
|---|---|---|
| `RequisitionId` | → | `externalJobId` |
| `Title` | → | `title` |
| Constructed URL | → | `url` |
| `Organization` or `Department` or `JobFamily` | → | `department` |
| `PrimaryLocation` + `secondaryLocations` | → | `locations` |
| `WorkplaceType` | → | `locationType` (Remote/Hybrid/null) |
| Description HTML | → | `jobDescriptionHtml` |
| `PostedDate` | → | `postedAt` |
| `PostingEndDate` | → | `postingEndDate` |
| Salary (extract from description if present) | → | `salaryMin`/`salaryMax` |

**Implementation steps:**

- [x] **1a.** Create `scraper/src/adapters/oracle.ts`
  - `parseOracleUrl(baseUrl)` — extract host + siteId from career site URL
  - Define response types (`OracleJobRequisition`, `OracleListResponse`)
  - `OracleAdapter` class implementing `AtsAdapter`
  - Paginate with `limit=25`, `offset+=25`, stop when `!hasMore`
  - Filter: US via `workLocationCountryCode=US` query param (server-side)
  - Salary: reuse `extractSalaryFromHtml()` pattern (Oracle rarely has structured salary)
  - Location type: map `WorkplaceType` field directly (values like "Remote", "Hybrid", "On-Site")
  - 500ms delay between pages

- [x] **1b.** Create lightweight Next.js port in `src/lib/scraper/adapters.ts`
  - Add `scrapeOracle()` function matching the pattern of `scrapeGreenhouse()`/`scrapeICIMS()`
  - Same logic, inline (no scraper package imports)

- [x] **1c.** Wire up
  - Add `ORACLE` to `AtsPlatform` enum in `prisma/schema.prisma`
  - Add `"ORACLE"` to `atsPlatformValues` in `src/lib/validations/scraper.ts`
  - Register `OracleAdapter` in `scraper/src/adapters/registry.ts`
  - Add `ORACLE: scrapeOracle` to `batchScrapers` in `src/lib/scraper/scrape-company.ts`

- [x] **1d.** Validate against a live Oracle HCM site
  - Pick a known Oracle HCM company (e.g. Oracle itself, JPMorgan Chase)
  - Verify the API endpoint returns data
  - Confirm field mapping is correct

---

### Adapter 2: SAP SuccessFactors (SUCCESSFACTORS)

**API:** XML job feed — `https://{host}/career?company={companyId}&career_ns=job_listing_summary&resultType=XML`
- Public, no auth required
- Returns all jobs in a single response (no pagination needed — like Lever)
- XML format (need to parse XML)

**Base URL format:** `https://career{N}.successfactors.{tld}/career?company={companyId}`
- Example: `https://career2.successfactors.eu/career?company=esa`
- Need to parse: host + companyId from the URL

**XML parsing:**
- Use built-in DOMParser or a lightweight XML parser
- The scraper package can use `fast-xml-parser` (lightweight, no native deps)
- The Next.js port can use the same package (it's pure JS)

**Field mapping to ScrapedJobData:**
| SAP field | → | ScrapedJobData field |
|---|---|---|
| Job req ID | → | `externalJobId` |
| Job title | → | `title` |
| Constructed detail URL | → | `url` |
| Department/Category | → | `department` |
| Location | → | `locations` (filter to US via `isUSLocation()`) |
| Location text | → | `locationType` (infer Remote/Hybrid) |
| Description | → | `jobDescriptionHtml` |
| Posted date | → | `postedAt` |
| N/A | → | `postingEndDate` (null) |
| Salary (extract from description) | → | `salaryMin`/`salaryMax` |

**Implementation steps:**

- [x] **2a.** Add `fast-xml-parser` dependency to `scraper/` package + root package
  - Lightweight (no native deps), works in both Node.js and edge runtimes

- [x] **2b.** Create `scraper/src/adapters/successfactors.ts`
  - `parseSuccessFactorsUrl(baseUrl)` — extract host + companyId
  - Fetch XML feed URL
  - Parse XML with `fast-xml-parser`
  - Define response type for the XML structure
  - `SuccessFactorsAdapter` class implementing `AtsAdapter`
  - Single request (no pagination) — like Lever
  - Filter: US via `isUSLocation()` (no server-side country filter)
  - Salary: reuse `extractSalaryFromHtml()` pattern
  - Location type: infer from location text

- [x] **2c.** Create lightweight Next.js port in `src/lib/scraper/adapters.ts`
  - Add `scrapeSuccessFactors()` function
  - Same logic, inline

- [x] **2d.** Wire up
  - Add `SUCCESSFACTORS` to `AtsPlatform` enum in `prisma/schema.prisma`
  - Add `"SUCCESSFACTORS"` to `atsPlatformValues` in `src/lib/validations/scraper.ts`
  - Register `SuccessFactorsAdapter` in `scraper/src/adapters/registry.ts`
  - Add `SUCCESSFACTORS: scrapeSuccessFactors` to `batchScrapers` in `src/lib/scraper/scrape-company.ts`

- [x] **2e.** Validate against a live SuccessFactors site
  - Pick a known SF company
  - Verify the XML feed returns data and the structure matches expectations
  - Confirm field mapping + US location filtering works

---

### Shared steps

- [ ] **3a.** (pending) Run Prisma migration: `npx prisma migrate dev --name add-oracle-successfactors-platforms`
- [x] **3b.** Run `npx prisma generate`
- [x] **3c.** Run `npx tsc --noEmit` — verify 0 errors
- [x] **3d.** Run `npx vitest run` — verify all tests pass
- [ ] **3e.** (pending) Run `npm run build` — verify build succeeds

---

### Key decisions

1. **No streaming** — Both adapters use batch fetch (Oracle paginates, SAP returns all at once). Neither needs the Workday-style `onJob` callback. They go in the `batchScrapers` map.

2. **XML parser choice** — `fast-xml-parser` is pure JS, zero native deps, works in Next.js edge runtime. Single dependency for SAP adapter.

3. **Oracle API version** — Using `11.13.18.05` (the ICE endpoint version documented by Oracle). This is stable — it's what their own career sites use.

4. **Enum naming** — `ORACLE` (not `ORACLE_HCM` — keep it short like the others). `SUCCESSFACTORS` (not `SAP` — too generic, and the platform name is SuccessFactors).

5. **No detail endpoint needed for Oracle** — The list endpoint returns rich data (title, locations, description, dates). Unlike Workday, we don't need per-job detail requests, which makes this adapter fast.

6. **SAP detail page** — The XML feed may not include full job descriptions. If it only has summaries, we'll need to fetch individual detail pages. Determine during validation (step 2e). If needed, add sequential detail fetches with 500ms delay (like Workday).
