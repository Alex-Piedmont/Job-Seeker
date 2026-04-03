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

## Expansion Priority & Recommendations

### Priority 1: Existing adapter site discovery (17 companies, zero code changes)

These companies run on platforms we already support but weren't imported because their site identifiers need discovery. Pure configuration work — no adapter code required.

**Oracle Cloud HCM** — 11 companies, adapter already exists:

| Company | Industry | Known Host |
|---------|----------|-----------|
| Texas Instruments | Technology | `edbz.fa.us2.oraclecloud.com` |
| Citizens Financial Group | Banking | `hcgn.fa.us2.oraclecloud.com` |
| Southern Company | Energy | `emje.fa.us6.oraclecloud.com` |
| Cummins | Industrial | `fa-espx-saasfaprod1.fa.ocs.oraclecloud.com` |
| CSX Corporation | Transportation | `fa-eowa-saasfaprod1.fa.ocs.oraclecloud.com` |
| Molina Healthcare | Healthcare | `hckd.fa.us2.oraclecloud.com` |
| Macy's | Retail | `ebwh.fa.us2.oraclecloud.com` |
| Yum! Brands | Consumer | `eczd.fa.us2.oraclecloud.com` |
| KPMG | Professional Services | `ejgk.fa.em2.oraclecloud.com` |
| Sherwin-Williams | Industrial | `ejhp.fa.us6.oraclecloud.com` |

Action: Probe each host's `/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitions` with candidate site numbers (`CX_1`, `CX_1001`, `jobsearch`, etc.) to find the working endpoint, then insert.

**SAP SuccessFactors** — 6 companies, adapter already exists:

| Company | Industry | Known Feed Host | Company ID |
|---------|----------|----------------|------------|
| Lincoln National | Insurance | `career4.successfactors.com` | TBD |
| NextEra Energy | Energy | `career8.successfactors.com` | `NEE` |
| Entergy | Energy | `career-hcm20.ns2cloud.com` | `ENTHCM20` |
| Colgate-Palmolive | Consumer | `career4.successfactors.com` | TBD |
| Union Pacific | Transportation | `career4.successfactors.com` | `UPProd` |
| Norfolk Southern | Transportation | `career8.successfactors.com` | `S003808746P` |

Action: Test XML feed URLs (`?career_ns=job_listing_summary&resultType=XML`) with the known company IDs. For Lincoln National and Colgate-Palmolive, scrape their branded career pages to extract the `ssoCompanyId` from page source.

**iCIMS** — 3 companies (may need adapter enhancement for traditional `*.icims.com` portals):

| Company | Industry | Portal |
|---------|----------|--------|
| Exelon | Energy | `careers-exeloncorp.icims.com` |
| Constellation Energy | Energy | iCIMS with Jibe frontend |
| Dollar General | Retail | `retail-dollargeneral.icims.com` (retail) / Jibe frontend (corporate) |

Note: Current iCIMS adapter supports Jibe-powered sites (`/api/jobs`). Traditional `*.icims.com` portals use a different interface and may require an adapter extension.

### Priority 2: SmartRecruiters adapter (5 companies) ✅ DONE

Adapter implemented. 5 viable companies imported (~4,158 jobs):

| Company | Industry | Status |
|---------|----------|--------|
| Visa | Financial Services | ✅ Imported |
| ServiceNow | Technology | ✅ Imported |
| AbbVie | Pharma | ✅ Imported |
| McDonald's | Consumer | ✅ Imported (identifier: `McDonaldsCorporation`) |
| Public Storage | Real Estate | ✅ Imported |
| Palo Alto Networks | Technology | ❌ Removed — 0 postings on platform |
| Verisk Analytics | Financial Services | ❌ Removed — 0 postings on platform |

### Priority 3: Eightfold AI adapter (9/10 companies) ✅ PARTIALLY DONE

Adapter implemented with PCSX/SmartApply dual-mode auto-detection. 9 companies imported:

| Company | Industry | Variant | Status |
|---------|----------|---------|--------|
| Microsoft | Technology | PCSX | ✅ Imported |
| Qualcomm | Technology | PCSX | ✅ Imported |
| Micron Technology | Technology | PCSX | ✅ Imported |
| HP Inc. | Technology | PCSX | ✅ Imported |
| Estee Lauder | Consumer | PCSX | ✅ Imported |
| Boston Scientific | Healthcare | PCSX | ✅ Imported |
| Starbucks | Consumer | PCSX | ✅ Imported (filtered to corporate roles only) |
| Deere & Company | Industrial | SmartApply | ✅ Imported |
| Freeport-McMoRan | Mining | SmartApply | ✅ Imported |
| Netflix | Technology | — | ⏳ Deferred (PCSX disabled for anonymous users, needs sitemap+JSON-LD fallback) |
| Uber | Technology | — | ❌ Not Eightfold (uses custom platform) |
| PepsiCo | Consumer | — | ❌ Not Eightfold (uses custom platform) |

### Priority 4: Oracle Taleo adapter (8 companies)
**Priority:** Low | **Category:** Scraper coverage | **Effort:** Medium

| Company | Industry | URL |
|---------|----------|-----|
| UnitedHealth Group | Healthcare | `https://uhg.taleo.net/careersection/10030/joblist.ftl` |
| American Express | Financial Services | `https://axp.taleo.net/careersection/6/jobsearch.ftl` |
| Johnson & Johnson | Pharma | `https://jnjc.taleo.net` |
| HCA Healthcare | Healthcare | `https://hca.taleo.net/careersection/0hca/jobsearch.ftl` |
| Valero Energy | Energy | `https://valero.taleo.net/careersection/2/jobsearch.ftl` |
| United Airlines | Transportation | `https://ual-pro.taleo.net/careersection/2/default.ftl` |
| Textron | Industrial | `https://textron.taleo.net/careersection/textron/moresearch.ftl` |
| Ross Stores | Retail | `https://rossstores.taleo.net` |

Oracle Taleo is a legacy ATS with structured URL patterns (`*.taleo.net/careersection/{section}/jobsearch.ftl`). The API surface is somewhat standardized across deployments, making a generic adapter feasible. However, Taleo is being sunset by Oracle in favor of Oracle Recruiting Cloud, so some of these companies may migrate in the near term.

### Priority 5: Other adapters

#### Phenom People adapter
**Priority:** Medium | **Category:** Scraper coverage

Needed for: **Snowflake** (`https://careers.snowflake.com/us/en`), **Koch Industries** (`https://jobs.kochcareers.com`), **Republic Services** (`https://jobs.republicservices.com/us/en/careers`).

Phenom serves as both a CMS and ATS layer with its own widget-based API (`/widgets` endpoints, `ph-` prefixed components). Requires research into their API structure for paginated job listing and detail fetching.

#### Avature adapter
**Priority:** Low | **Category:** Scraper coverage

Needed for: **IBM** (`https://careers.ibm.com`; login portal at `ibmglobal.avature.net`), **Delta Air Lines** (`https://delta.avature.net/en_US/careers`), **CBRE Group** (`https://careers.cbre.com/en_US/careers/Home`), **Goldman Sachs** (Oleeo/Avature hybrid at `goldmansachs.tal.net`).

Avature is a highly customized CRM/ATS. Each implementation is heavily custom-branded, making a generic adapter difficult. Needs research into whether a public-facing job listing API exists.

#### TalentBrew (iCIMS) adapter
**Priority:** Low | **Category:** Scraper coverage

Needed for: **Intuit** (`https://jobs.intuit.com`), **L3Harris** (`https://careers.l3harris.com`), **Cargill** (`https://careers.cargill.com`).

TalentBrew is an iCIMS career site product (employer branding layer on top of iCIMS ATS). Uses its own CDN (`tbcdn.talentbrew.com`) and URL conventions distinct from the Jibe-powered iCIMS sites the existing adapter supports. May need a separate adapter or an extension to the existing iCIMS adapter.

#### BrassRing (IBM Kenexa) adapter
**Priority:** Low | **Category:** Scraper coverage

Needed for: **Edward Jones** (`https://careers.edwardjones.com/`), **Lockheed Martin** (`https://sjobs.brassring.com`), **ADM** (`https://sjobs.brassring.com`).

Legacy platform with `sjobs.brassring.com` URL patterns. Declining market share but still used by a few large employers.

### Other niche platforms (informational)

| Company | Platform | URL |
|---------|----------|-----|
| Electronic Arts | gr8people | `https://ea.gr8people.com/jobs` |
| Align Technology | Pinpoint | `https://jobs.aligntech.com/search-job` |
| Parker Hannifin | TTC Portals | `https://parkercareers.ttcportals.com/jobs/search` |
| Fortive | Radancy/DeJobs | `https://careers.fortive.com/` |
| EOG Resources | SmartSearchOnline | `https://careers.eogresources.com/` |
| Progressive | Jobvite | `https://careers.progressive.com` |
| BioMarin | Jobvite | `https://jobs.jobvite.com/biomarin/` |

### Custom/Proprietary ATS (informational)

These companies use fully custom or proprietary career platforms that would require bespoke scrapers:

| Company | URL |
|---------|-----|
| Apple | `https://jobs.apple.com/en-us/search` |
| Alphabet/Google | `https://www.google.com/about/careers/applications/jobs/results` |
| Amazon | `https://www.amazon.jobs/en/search` |
| Meta | `https://www.metacareers.com/jobs` |
| Deloitte | `https://apply.deloitte.com/` |
| McKinsey & Company | `https://www.mckinsey.com/careers/search-jobs` |
| BCG | `https://careers.bcg.com/` |
| Bain & Company | `https://www.bain.com/careers/` |
| ADP | `https://jobs.adp.com/` |
| Paychex | `https://www.paychex.com/careers` |
| Publix Super Markets | `https://apply.publix.jobs/` |
