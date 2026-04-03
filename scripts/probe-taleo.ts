/**
 * Sprint 4 AU-5: Probe Taleo career sections for the 8 target companies
 *
 * Usage: DATABASE_URL=<url> npx tsx scripts/probe-taleo.ts [--dry-run]
 */

import pg from "pg";
import { createId } from "../scraper/node_modules/@paralleldrive/cuid2/index.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface TaleoTarget {
  name: string;
  tenant: string;
  csCode: string;
}

const TARGETS: TaleoTarget[] = [
  { name: "UnitedHealth Group", tenant: "uhg", csCode: "10030" },
  { name: "American Express", tenant: "axp", csCode: "6" },
  { name: "Johnson & Johnson", tenant: "jnjc", csCode: "2" },
  { name: "HCA Healthcare", tenant: "hca", csCode: "0hca" },
  { name: "Valero Energy", tenant: "valero", csCode: "2" },
  { name: "United Airlines", tenant: "ual-pro", csCode: "2" },
  { name: "Textron", tenant: "textron", csCode: "textron" },
  { name: "Ross Stores", tenant: "rossstores", csCode: "2" },
];

interface ProbeResult {
  name: string;
  baseUrl: string;
  success: boolean;
  jobCount: number;
  portalNo?: string;
  error?: string;
}

function buildSearchBody(pageNo: number): object {
  return {
    multilineEnabled: false,
    sortingSelection: { sortBySelectionParam: "1", ascendingSortingOrder: "false" },
    fieldData: { fields: { KEYWORD: "", LOCATION: "" }, valid: true },
    filterSelectionParam: {
      searchFilterSelections: [
        { id: "POSTING_DATE", selectedValues: [] },
        { id: "LOCATION", selectedValues: [] },
        { id: "JOB_FIELD", selectedValues: [] },
        { id: "JOB_TYPE", selectedValues: [] },
        { id: "JOB_SCHEDULE", selectedValues: [] },
      ],
    },
    advancedSearchFiltersSelectionParam: {
      searchFilterSelections: [
        { id: "ORGANIZATION", selectedValues: [] },
        { id: "LOCATION", selectedValues: [] },
        { id: "JOB_FIELD", selectedValues: [] },
        { id: "JOB_NUMBER", selectedValues: [] },
        { id: "URGENT_JOB", selectedValues: [] },
        { id: "EMPLOYEE_STATUS", selectedValues: [] },
      ],
    },
    pageNo,
  };
}

async function probeTarget(target: TaleoTarget): Promise<ProbeResult> {
  const host = `${target.tenant}.taleo.net`;
  const baseUrl = `https://${host}/careersection/${target.csCode}/jobsearch.ftl`;

  console.log(`  Probing ${target.name} (${host}/${target.csCode})...`);

  try {
    // Step 1: Fetch career section page and extract portalNo
    const pageResp = await fetch(baseUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (!pageResp.ok) {
      return { name: target.name, baseUrl, success: false, jobCount: 0, error: `Page returned ${pageResp.status}` };
    }

    const html = await pageResp.text();

    // Check for unavailable career section
    if (html.includes("careerSectionUnAvailable") && html.includes("true")) {
      return { name: target.name, baseUrl, success: false, jobCount: 0, error: "Career section unavailable (migrated?)" };
    }

    const portalMatch = html.match(/portalNo\s*[:=]\s*['"]?(\d+)['"]?/)
      ?? html.match(/portal\s*=\s*['"]?(\d{6,})['"]?/);

    if (!portalMatch) {
      return { name: target.name, baseUrl, success: false, jobCount: 0, error: "Could not extract portalNo" };
    }
    const portalNo = portalMatch[1];

    // Step 2: Hit search API
    const searchUrl = `https://${host}/careersection/rest/jobboard/searchjobs?lang=en&portal=${portalNo}`;
    const searchResp = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "tz": "GMT-05:00",
      },
      body: JSON.stringify(buildSearchBody(1)),
      signal: AbortSignal.timeout(20000),
    });

    if (!searchResp.ok) {
      return { name: target.name, baseUrl, success: false, jobCount: 0, portalNo, error: `Search API returned ${searchResp.status}` };
    }

    const data = (await searchResp.json()) as {
      pagingData?: { totalCount: number };
    };
    const totalCount = data.pagingData?.totalCount ?? 0;

    if (totalCount > 0) {
      console.log(`    ✅ ${target.name}: portalNo=${portalNo} → ${totalCount} jobs`);
      return { name: target.name, baseUrl, success: true, jobCount: totalCount, portalNo };
    } else {
      return { name: target.name, baseUrl, success: false, jobCount: 0, portalNo, error: "Search returned 0 jobs" };
    }
  } catch (err) {
    return { name: target.name, baseUrl, success: false, jobCount: 0, error: (err as Error).message };
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl && !dryRun) {
    console.error("ERROR: DATABASE_URL required (or use --dry-run)");
    process.exit(1);
  }

  console.log(`\nTaleo Company Probe (${dryRun ? "DRY RUN" : "LIVE"})\n`);
  console.log("═══ Oracle Taleo (8 companies) ═══");

  const results: ProbeResult[] = [];
  for (const target of TARGETS) {
    const result = await probeTarget(target);
    results.push(result);
  }

  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  console.log("\n═══════════════════════════════════════");
  console.log("RESULTS");
  console.log("═══════════════════════════════════════");

  if (successes.length > 0) {
    console.log(`\n✅ Resolved (${successes.length}):`);
    for (const s of successes) {
      console.log(`  + ${s.name} [TALEO] → ${s.jobCount} jobs (portal ${s.portalNo})`);
      console.log(`    baseUrl: ${s.baseUrl}`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n❌ Unresolved (${failures.length}):`);
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  // Insert into DB
  if (!dryRun && successes.length > 0 && dbUrl) {
    console.log(`\n💾 Inserting ${successes.length} companies into database...`);
    const pool = new pg.Pool({ connectionString: dbUrl });

    try {
      const { rows: existing } = await pool.query("SELECT name FROM companies");
      const existingNames = new Set(existing.map((r: { name: string }) => r.name.toLowerCase()));

      let inserted = 0;
      let skipped = 0;

      for (const result of successes) {
        if (existingNames.has(result.name.toLowerCase())) {
          console.log(`  ⏩ ${result.name} already in DB, skipping`);
          skipped++;
          continue;
        }

        try {
          await pool.query(
            `INSERT INTO companies (id, name, "atsPlatform", "baseUrl", enabled, "isRemoved", "scrapeStatus", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, true, false, 'PENDING', NOW(), NOW())
             ON CONFLICT (name) DO NOTHING`,
            [createId(), result.name, "TALEO", result.baseUrl],
          );
          console.log(`  ✅ Inserted ${result.name}`);
          inserted++;
        } catch (e: unknown) {
          console.error(`  ❌ Failed to insert ${result.name}: ${(e as Error).message}`);
        }
      }

      console.log(`\n📊 Inserted: ${inserted}, Skipped: ${skipped}`);
    } finally {
      await pool.end();
    }
  } else if (dryRun) {
    console.log("\n🔒 Dry run — no changes made to database");
  }

  console.log(`\nTotal: ${successes.length} resolved, ${failures.length} unresolved\n`);
}

main().catch(console.error);
