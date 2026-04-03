/**
 * Sprint 4 AU-1: Insert Nordstrom (Workday), BNY Mellon (Oracle HCM), Waste Management (Oracle HCM)
 *
 * Usage: DATABASE_URL=<url> npx tsx scripts/insert-sprint4-companies.ts [--dry-run]
 */

import pg from "pg";
import { createId } from "../scraper/node_modules/@paralleldrive/cuid2/index.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface CompanyInsert {
  name: string;
  atsPlatform: string;
  baseUrl: string;
  verifyUrl: string;
  verifyType: "workday" | "oracle";
}

const COMPANIES: CompanyInsert[] = [
  {
    name: "Nordstrom",
    atsPlatform: "WORKDAY",
    baseUrl: "https://nordstrom.wd501.myworkdayjobs.com/nordstrom_careers",
    verifyUrl: "https://nordstrom.wd501.myworkdayjobs.com/wday/cxs/nordstrom/nordstrom_careers/jobs",
    verifyType: "workday",
  },
  {
    name: "BNY Mellon",
    atsPlatform: "ORACLE",
    baseUrl: "https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001",
    verifyUrl: "https://eofe.fa.us2.oraclecloud.com/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitions?finder=findReqs;siteNumber=CX_1001,limit=1,offset=0,sortBy=POSTING_DATES_DESC&onlyData=true&expand=requisitionList",
    verifyType: "oracle",
  },
  {
    name: "Waste Management",
    atsPlatform: "ORACLE",
    baseUrl: "https://emcm.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/WMCareers",
    verifyUrl: "https://emcm.fa.us2.oraclecloud.com/hcmRestApi/resources/11.13.18.05/recruitingCEJobRequisitions?finder=findReqs;siteNumber=WMCareers,limit=1,offset=0,sortBy=POSTING_DATES_DESC&onlyData=true&expand=requisitionList",
    verifyType: "oracle",
  },
];

async function verifyEndpoint(company: CompanyInsert): Promise<number> {
  if (company.verifyType === "workday") {
    const resp = await fetch(company.verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ limit: 1, offset: 0 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return 0;
    const data = (await resp.json()) as { total?: number };
    return data.total ?? 0;
  }

  // Oracle HCM
  const resp = await fetch(company.verifyUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return 0;
  const data = (await resp.json()) as {
    items?: Array<{ TotalJobsCount?: number }>;
  };
  return data.items?.[0]?.TotalJobsCount ?? 0;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl && !dryRun) {
    console.error("ERROR: DATABASE_URL required (or use --dry-run)");
    process.exit(1);
  }

  console.log(`\nSprint 4 AU-1: Company Imports (${dryRun ? "DRY RUN" : "LIVE"})\n`);

  for (const company of COMPANIES) {
    try {
      const jobCount = await verifyEndpoint(company);
      if (jobCount === 0) {
        console.log(`  ❌ ${company.name} [${company.atsPlatform}]: no jobs found, skipping`);
        continue;
      }
      console.log(`  ✅ ${company.name} [${company.atsPlatform}]: ${jobCount} jobs`);

      if (!dryRun && dbUrl) {
        const pool = new pg.Pool({ connectionString: dbUrl });
        try {
          const result = await pool.query(
            `INSERT INTO companies (id, name, "atsPlatform", "baseUrl", enabled, "isRemoved", "scrapeStatus", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, true, false, 'PENDING', NOW(), NOW())
             ON CONFLICT (name) DO NOTHING`,
            [createId(), company.name, company.atsPlatform, company.baseUrl],
          );
          if (result.rowCount === 0) {
            console.log(`     ⏩ Already exists in DB`);
          } else {
            console.log(`     💾 Inserted`);
          }
        } finally {
          await pool.end();
        }
      }
    } catch (err) {
      console.error(`  ❌ ${company.name}: ${(err as Error).message}`);
    }
  }

  console.log("\nDone.\n");
}

main().catch(console.error);
