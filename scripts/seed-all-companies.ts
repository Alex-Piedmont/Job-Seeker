/**
 * Unified Company Seed Script
 *
 * Seeds all known-good companies into a fresh database.
 * No runtime probing — only verified URLs from existing scripts + ATS Mappings research.
 * Git history corrections (commit a1cf626) applied.
 *
 * Usage: DATABASE_URL=<url> npx tsx scripts/seed-all-companies.ts [--dry-run]
 */

import pg from "pg";
import { createId } from "../scraper/node_modules/@paralleldrive/cuid2/index.js";

type AtsPlatform =
  | "GREENHOUSE"
  | "LEVER"
  | "WORKDAY"
  | "ICIMS"
  | "ORACLE"
  | "SUCCESSFACTORS"
  | "SMARTRECRUITERS"
  | "EIGHTFOLD";

interface CompanyEntry {
  name: string;
  atsPlatform: AtsPlatform;
  baseUrl: string;
}

const COMPANIES: CompanyEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // WORKDAY — verified myworkdayjobs.com / myworkdaysite.com URLs
  // ═══════════════════════════════════════════════════════════════════════

  // ── Technology ────────────────────────────────────────────────────────
  { name: "Salesforce", atsPlatform: "WORKDAY", baseUrl: "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site" },
  { name: "Adobe", atsPlatform: "WORKDAY", baseUrl: "https://adobe.wd5.myworkdayjobs.com/external_experienced" },
  { name: "Intel", atsPlatform: "WORKDAY", baseUrl: "https://intel.wd1.myworkdayjobs.com/External" },
  { name: "NVIDIA", atsPlatform: "WORKDAY", baseUrl: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite" },
  { name: "Broadcom", atsPlatform: "WORKDAY", baseUrl: "https://broadcom.wd1.myworkdayjobs.com/External_Career" },
  { name: "Applied Materials", atsPlatform: "WORKDAY", baseUrl: "https://amat.wd1.myworkdayjobs.com/External" },
  { name: "CrowdStrike", atsPlatform: "WORKDAY", baseUrl: "https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers" },
  { name: "Dell Technologies", atsPlatform: "WORKDAY", baseUrl: "https://dell.wd1.myworkdayjobs.com/External" },
  { name: "Hewlett Packard Enterprise", atsPlatform: "WORKDAY", baseUrl: "https://hpe.wd5.myworkdayjobs.com/Jobsathpe" },
  { name: "Snap Inc.", atsPlatform: "WORKDAY", baseUrl: "https://snapchat.wd1.myworkdayjobs.com/snap" },
  { name: "PayPal", atsPlatform: "WORKDAY", baseUrl: "https://paypal.wd1.myworkdayjobs.com/jobs" },

  // ── Banking & Financial Services ─────────────────────────────────────
  { name: "Bank of America", atsPlatform: "WORKDAY", baseUrl: "https://ghr.wd1.myworkdayjobs.com/Lateral-US" },
  { name: "Citigroup", atsPlatform: "WORKDAY", baseUrl: "https://citi.wd5.myworkdayjobs.com/2" },
  { name: "Wells Fargo", atsPlatform: "WORKDAY", baseUrl: "https://wf.wd1.myworkdayjobs.com/WellsFargoJobs" },
  { name: "Morgan Stanley", atsPlatform: "WORKDAY", baseUrl: "https://ms.wd5.myworkdayjobs.com/External" },
  { name: "U.S. Bancorp", atsPlatform: "WORKDAY", baseUrl: "https://usbank.wd1.myworkdayjobs.com/US_Bank_Careers" },
  { name: "PNC Financial", atsPlatform: "WORKDAY", baseUrl: "https://pnc.wd5.myworkdayjobs.com/External" },
  { name: "Truist Financial", atsPlatform: "WORKDAY", baseUrl: "https://truist.wd1.myworkdayjobs.com/Careers" },
  { name: "Capital One", atsPlatform: "WORKDAY", baseUrl: "https://capitalone.wd12.myworkdayjobs.com/Capital_One" },
  { name: "TD Bank", atsPlatform: "WORKDAY", baseUrl: "https://td.wd3.myworkdayjobs.com/TD_Bank_Careers" },
  { name: "Mastercard", atsPlatform: "WORKDAY", baseUrl: "https://mastercard.wd1.myworkdayjobs.com/CorporateCareers" },
  { name: "BlackRock", atsPlatform: "WORKDAY", baseUrl: "https://blackrock.wd1.myworkdayjobs.com/BlackRock_Professional" },
  { name: "State Street Corporation", atsPlatform: "WORKDAY", baseUrl: "https://statestreet.wd1.myworkdayjobs.com/Global" },
  { name: "Northern Trust", atsPlatform: "WORKDAY", baseUrl: "https://ntrs.wd1.myworkdayjobs.com/northerntrust" },
  { name: "Raymond James", atsPlatform: "WORKDAY", baseUrl: "https://raymondjames.wd1.myworkdayjobs.com/RaymondJamesCareers" },
  { name: "T. Rowe Price", atsPlatform: "WORKDAY", baseUrl: "https://troweprice.wd5.myworkdayjobs.com/TRowePrice" },
  { name: "Franklin Templeton", atsPlatform: "WORKDAY", baseUrl: "https://franklintempleton.wd5.myworkdayjobs.com/Primary-External-1" },
  { name: "Fidelity Investments", atsPlatform: "WORKDAY", baseUrl: "https://fmr.wd1.myworkdayjobs.com/FidelityCareers" },
  { name: "S&P Global", atsPlatform: "WORKDAY", baseUrl: "https://spgi.wd5.myworkdayjobs.com/SPGI_Careers" },
  // Moody's Corporation removed — migrated to SuccessFactors
  { name: "CME Group", atsPlatform: "WORKDAY", baseUrl: "https://cmegroup.wd1.myworkdayjobs.com/cme_careers" },
  { name: "Marsh McLennan", atsPlatform: "WORKDAY", baseUrl: "https://mmc.wd1.myworkdayjobs.com/MMC" },
  // Verisk Analytics removed — migrated to Oracle Cloud HCM

  // ── Insurance ────────────────────────────────────────────────────────
  { name: "Elevance Health", atsPlatform: "WORKDAY", baseUrl: "https://elevancehealth.wd1.myworkdayjobs.com/ANT" },
  { name: "Cigna Group", atsPlatform: "WORKDAY", baseUrl: "https://cigna.wd5.myworkdayjobs.com/cignacareers" },
  { name: "Humana", atsPlatform: "WORKDAY", baseUrl: "https://humana.wd5.myworkdayjobs.com/Humana_External_Career_Site" },
  { name: "Prudential Financial", atsPlatform: "WORKDAY", baseUrl: "https://pru.wd5.myworkdayjobs.com/Careers" },
  { name: "AIG", atsPlatform: "WORKDAY", baseUrl: "https://aig.wd1.myworkdayjobs.com/AIG" },
  { name: "Travelers", atsPlatform: "WORKDAY", baseUrl: "https://travelers.wd5.myworkdayjobs.com/External" },
  { name: "Allstate", atsPlatform: "WORKDAY", baseUrl: "https://allstate.wd5.myworkdayjobs.com/allstate_careers" },
  { name: "Hartford Financial", atsPlatform: "WORKDAY", baseUrl: "https://thehartford.wd5.myworkdayjobs.com/Careers_External" },

  // ── Healthcare, Pharma & Biotech ─────────────────────────────────────
  { name: "Merck & Co.", atsPlatform: "WORKDAY", baseUrl: "https://msd.wd5.myworkdayjobs.com/SearchJobs" },
  { name: "Eli Lilly", atsPlatform: "WORKDAY", baseUrl: "https://lilly.wd5.myworkdayjobs.com/LLY" },
  { name: "Bristol-Myers Squibb", atsPlatform: "WORKDAY", baseUrl: "https://bristolmyerssquibb.wd5.myworkdayjobs.com/BMS" },
  { name: "Amgen", atsPlatform: "WORKDAY", baseUrl: "https://amgen.wd1.myworkdayjobs.com/Careers" }, // Git correction: was incorrectly BMS
  { name: "Gilead Sciences", atsPlatform: "WORKDAY", baseUrl: "https://gilead.wd1.myworkdayjobs.com/gileadcareers" },
  { name: "Regeneron", atsPlatform: "WORKDAY", baseUrl: "https://regeneron.wd1.myworkdayjobs.com/Careers" },
  { name: "Moderna", atsPlatform: "WORKDAY", baseUrl: "https://modernatx.wd1.myworkdayjobs.com/M_tx" },
  { name: "Biogen", atsPlatform: "WORKDAY", baseUrl: "https://biibhr.wd3.myworkdayjobs.com/external" },
  { name: "Vertex Pharmaceuticals", atsPlatform: "WORKDAY", baseUrl: "https://vrtx.wd501.myworkdayjobs.com/Vertex_Careers" },
  { name: "Zoetis", atsPlatform: "WORKDAY", baseUrl: "https://zoetis.wd5.myworkdayjobs.com/zoetis" },
  { name: "Illumina", atsPlatform: "WORKDAY", baseUrl: "https://illumina.wd1.myworkdayjobs.com/illumina-careers" },
  { name: "CVS Health", atsPlatform: "WORKDAY", baseUrl: "https://cvshealth.wd1.myworkdayjobs.com/CVS_Health_Careers" },
  { name: "McKesson", atsPlatform: "WORKDAY", baseUrl: "https://mckesson.wd3.myworkdayjobs.com/External_Careers" },
  { name: "Cencora", atsPlatform: "WORKDAY", baseUrl: "https://myhrabc.wd5.myworkdayjobs.com/Global" },
  { name: "Cardinal Health", atsPlatform: "WORKDAY", baseUrl: "https://cardinalhealth.wd1.myworkdayjobs.com/EXT" },
  { name: "Centene Corporation", atsPlatform: "WORKDAY", baseUrl: "https://centene.wd5.myworkdayjobs.com/Centene_External" },
  { name: "DaVita", atsPlatform: "WORKDAY", baseUrl: "https://davita.wd1.myworkdayjobs.com/DKC_External" },
  { name: "Medtronic", atsPlatform: "WORKDAY", baseUrl: "https://medtronic.wd1.myworkdayjobs.com/MedtronicCareers" },
  { name: "Abbott Laboratories", atsPlatform: "WORKDAY", baseUrl: "https://abbott.wd5.myworkdayjobs.com/abbottcareers" },
  { name: "Baxter International", atsPlatform: "WORKDAY", baseUrl: "https://baxter.wd1.myworkdayjobs.com/baxter" },
  { name: "Becton Dickinson", atsPlatform: "WORKDAY", baseUrl: "https://bdx.wd1.myworkdayjobs.com/EXTERNAL_CAREER_SITE_USA" },
  { name: "Stryker", atsPlatform: "WORKDAY", baseUrl: "https://stryker.wd1.myworkdayjobs.com/StrykerCareers" },
  { name: "Edwards Lifesciences", atsPlatform: "WORKDAY", baseUrl: "https://edwards.wd5.myworkdayjobs.com/edwardscareers" },
  { name: "Danaher", atsPlatform: "WORKDAY", baseUrl: "https://danaher.wd1.myworkdayjobs.com/DanaherJobs" },
  { name: "Thermo Fisher Scientific", atsPlatform: "WORKDAY", baseUrl: "https://thermofisher.wd5.myworkdayjobs.com/ThermoFisherCareers" },
  { name: "Agilent Technologies", atsPlatform: "WORKDAY", baseUrl: "https://agilent.wd5.myworkdayjobs.com/Agilent_Careers" },

  // ── Energy, Utilities & Materials ────────────────────────────────────
  { name: "Chevron", atsPlatform: "WORKDAY", baseUrl: "https://chevron.wd5.myworkdayjobs.com/jobs" },
  { name: "ConocoPhillips", atsPlatform: "WORKDAY", baseUrl: "https://conocophillips.wd1.myworkdayjobs.com/External" },
  { name: "Baker Hughes", atsPlatform: "WORKDAY", baseUrl: "https://bakerhughes.wd5.myworkdayjobs.com/BakerHughes" },
  { name: "Marathon Petroleum", atsPlatform: "WORKDAY", baseUrl: "https://mpc.wd1.myworkdayjobs.com/MPCCareers" },
  // Hess Corporation removed — acquired by Chevron
  { name: "Devon Energy", atsPlatform: "WORKDAY", baseUrl: "https://devonenergy.wd5.myworkdayjobs.com/Careers" },
  { name: "Occidental Petroleum", atsPlatform: "WORKDAY", baseUrl: "https://oxy.wd5.myworkdayjobs.com/Corporate" },
  { name: "Diamondback Energy", atsPlatform: "WORKDAY", baseUrl: "https://diamondbackenergy.wd12.myworkdayjobs.com/DBE" },
  { name: "Duke Energy", atsPlatform: "WORKDAY", baseUrl: "https://dukeenergy.wd1.myworkdayjobs.com/Search" },
  { name: "AES Corporation", atsPlatform: "WORKDAY", baseUrl: "https://aes.wd1.myworkdayjobs.com/AES_US" },
  { name: "Xcel Energy", atsPlatform: "WORKDAY", baseUrl: "https://xcelenergy.wd1.myworkdayjobs.com/External" },
  { name: "Air Products", atsPlatform: "WORKDAY", baseUrl: "https://airproducts.wd5.myworkdayjobs.com/AP0001" },
  { name: "Dow Inc.", atsPlatform: "WORKDAY", baseUrl: "https://dow.wd1.myworkdayjobs.com/ExternalCareers" },
  { name: "DuPont", atsPlatform: "WORKDAY", baseUrl: "https://dupont.wd5.myworkdayjobs.com/Jobs" },

  // ── Consumer Goods, Retail & Food ────────────────────────────────────
  { name: "Walmart", atsPlatform: "WORKDAY", baseUrl: "https://walmart.wd5.myworkdayjobs.com/WalmartExternal" },
  { name: "Target", atsPlatform: "WORKDAY", baseUrl: "https://target.wd5.myworkdayjobs.com/targetcareers" },
  { name: "Lowe's", atsPlatform: "WORKDAY", baseUrl: "https://lowes.wd5.myworkdayjobs.com/LWS_External_CS" },
  { name: "TJX Companies", atsPlatform: "WORKDAY", baseUrl: "https://tjx.wd1.myworkdayjobs.com/TJX_EXTERNAL" },
  { name: "Nordstrom", atsPlatform: "WORKDAY", baseUrl: "https://nordstrom.wd501.myworkdayjobs.com/nordstrom_careers" },
  { name: "Dollar Tree", atsPlatform: "WORKDAY", baseUrl: "https://dollartree.wd5.myworkdayjobs.com/dollartreeus" },
  { name: "Procter & Gamble", atsPlatform: "WORKDAY", baseUrl: "https://pg.wd5.myworkdayjobs.com/1000" },
  { name: "Kimberly-Clark", atsPlatform: "WORKDAY", baseUrl: "https://kimberlyclark.wd1.myworkdayjobs.com/GLOBAL" },
  { name: "Church & Dwight", atsPlatform: "WORKDAY", baseUrl: "https://churchdwight.wd1.myworkdayjobs.com/chdcareers" },
  { name: "Clorox", atsPlatform: "WORKDAY", baseUrl: "https://clorox.wd1.myworkdayjobs.com/Clorox" },
  { name: "Coca-Cola", atsPlatform: "WORKDAY", baseUrl: "https://coke.wd1.myworkdayjobs.com/coca-cola-careers" },
  { name: "Mondelez International", atsPlatform: "WORKDAY", baseUrl: "https://mdlz.wd3.myworkdayjobs.com/External" },
  { name: "Kraft Heinz", atsPlatform: "WORKDAY", baseUrl: "https://heinz.wd1.myworkdayjobs.com/KraftHeinz_Careers" },
  { name: "Conagra Brands", atsPlatform: "WORKDAY", baseUrl: "https://conagrabrands.wd1.myworkdayjobs.com/Careers_US" },
  { name: "Tyson Foods", atsPlatform: "WORKDAY", baseUrl: "https://tysonfoods.wd5.myworkdayjobs.com/TSN" },
  { name: "Sysco", atsPlatform: "WORKDAY", baseUrl: "https://sysco.wd5.myworkdayjobs.com/syscocareers" },
  { name: "Chipotle", atsPlatform: "WORKDAY", baseUrl: "https://chipotle.wd5.myworkdayjobs.com/ChipotleCareers" },

  // ── Industrials, Aerospace & Defense ─────────────────────────────────
  { name: "Boeing", atsPlatform: "WORKDAY", baseUrl: "https://boeing.wd1.myworkdayjobs.com/EXTERNAL_CAREERS" },
  { name: "RTX (Raytheon)", atsPlatform: "WORKDAY", baseUrl: "https://globalhr.wd5.myworkdayjobs.com/REC_RTX_Ext_Gateway" },
  { name: "Northrop Grumman", atsPlatform: "WORKDAY", baseUrl: "https://ngc.wd1.myworkdayjobs.com/Northrop_Grumman_External_Site" },
  { name: "General Dynamics (GDIT)", atsPlatform: "WORKDAY", baseUrl: "https://gdit.wd5.myworkdayjobs.com/External_Career_Site" },
  { name: "Leidos", atsPlatform: "WORKDAY", baseUrl: "https://leidos.wd5.myworkdayjobs.com/External" },
  { name: "GE Aerospace", atsPlatform: "WORKDAY", baseUrl: "https://geaerospace.wd5.myworkdayjobs.com/GE_ExternalSite" },
  { name: "Howmet Aerospace", atsPlatform: "WORKDAY", baseUrl: "https://aero.wd5.myworkdayjobs.com/External" },
  { name: "3M", atsPlatform: "WORKDAY", baseUrl: "https://3m.wd1.myworkdayjobs.com/Search" },
  { name: "Caterpillar", atsPlatform: "WORKDAY", baseUrl: "https://cat.wd5.myworkdayjobs.com/CaterpillarCareers" },
  { name: "Rockwell Automation", atsPlatform: "WORKDAY", baseUrl: "https://rockwellautomation.wd1.myworkdayjobs.com/External_Rockwell_Automation" },
  { name: "Otis Worldwide", atsPlatform: "WORKDAY", baseUrl: "https://otis.wd5.myworkdayjobs.com/REC_Ext_Gateway" },
  { name: "Carrier Global", atsPlatform: "WORKDAY", baseUrl: "https://carrier.wd5.myworkdayjobs.com/jobs" },

  // ── Telecom & Media ──────────────────────────────────────────────────
  { name: "AT&T", atsPlatform: "WORKDAY", baseUrl: "https://att.wd1.myworkdayjobs.com/ATTGeneral" },
  { name: "Verizon", atsPlatform: "WORKDAY", baseUrl: "https://verizon.wd12.myworkdayjobs.com/verizon-careers" },
  { name: "T-Mobile", atsPlatform: "WORKDAY", baseUrl: "https://tmobile.wd1.myworkdayjobs.com/External" },
  { name: "Comcast", atsPlatform: "WORKDAY", baseUrl: "https://comcast.wd5.myworkdayjobs.com/Comcast_Careers" },
  { name: "Walt Disney Company", atsPlatform: "WORKDAY", baseUrl: "https://disney.wd5.myworkdayjobs.com/disneycareer" },
  { name: "Warner Bros. Discovery", atsPlatform: "WORKDAY", baseUrl: "https://warnerbros.wd5.myworkdayjobs.com/global" },
  { name: "Fox Corporation", atsPlatform: "WORKDAY", baseUrl: "https://fox.wd1.myworkdayjobs.com/FOXTVST_EAST" },

  // ── Transportation ───────────────────────────────────────────────────
  // FedEx removed — Workday portal has 0 active postings
  { name: "Southwest Airlines", atsPlatform: "WORKDAY", baseUrl: "https://swa.wd1.myworkdayjobs.com/external" },

  // ── Real Estate ──────────────────────────────────────────────────────
  { name: "Prologis", atsPlatform: "WORKDAY", baseUrl: "https://prologis.wd5.myworkdayjobs.com/Prologis_External_Careers" },
  { name: "Simon Property Group", atsPlatform: "WORKDAY", baseUrl: "https://simon.wd1.myworkdayjobs.com/Simon" },

  // ── Large Private / Professional Services ────────────────────────────
  { name: "Mars Inc.", atsPlatform: "WORKDAY", baseUrl: "https://mars.wd3.myworkdayjobs.com/External" },
  { name: "Bloomberg", atsPlatform: "WORKDAY", baseUrl: "https://bloomberg.wd1.myworkdayjobs.com/Bloombergindustrygroup_External_Career_Site" },
  // Bechtel removed — migrated to SuccessFactors
  { name: "PwC", atsPlatform: "WORKDAY", baseUrl: "https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers" },
  { name: "Accenture", atsPlatform: "WORKDAY", baseUrl: "https://accenture.wd103.myworkdayjobs.com/AccentureCareers" },
  { name: "Booz Allen Hamilton", atsPlatform: "WORKDAY", baseUrl: "https://bah.wd1.myworkdayjobs.com/BAH_Jobs" },

  // ═══════════════════════════════════════════════════════════════════════
  // GREENHOUSE
  // ═══════════════════════════════════════════════════════════════════════
  { name: "Take-Two Interactive", atsPlatform: "GREENHOUSE", baseUrl: "https://boards.greenhouse.io/taketwo" },
  // Snowflake: migrated to Phenom People
  // Bechtel: migrated to SuccessFactors
  // Hess Corporation: acquired by Chevron
  // Moody's Corporation: migrated to SuccessFactors
  // Verisk Analytics: migrated to Oracle Cloud HCM
  // Palo Alto Networks: migrated to TalentBrew
  // FedEx: Workday portal has 0 active postings
  { name: "Airbnb", atsPlatform: "GREENHOUSE", baseUrl: "https://boards.greenhouse.io/airbnb" },
  { name: "DoorDash", atsPlatform: "GREENHOUSE", baseUrl: "https://boards.greenhouse.io/doordashusa" },
  { name: "Pinterest", atsPlatform: "GREENHOUSE", baseUrl: "https://boards.greenhouse.io/pinterest" },

  // ═══════════════════════════════════════════════════════════════════════
  // LEVER
  // ═══════════════════════════════════════════════════════════════════════
  { name: "Palantir Technologies", atsPlatform: "LEVER", baseUrl: "https://jobs.lever.co/palantir" },
  { name: "Spotify", atsPlatform: "LEVER", baseUrl: "https://jobs.lever.co/spotify" },

  // ═══════════════════════════════════════════════════════════════════════
  // ORACLE Cloud HCM
  // ═══════════════════════════════════════════════════════════════════════
  { name: "JPMorgan Chase", atsPlatform: "ORACLE", baseUrl: "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001" },
  { name: "Oracle", atsPlatform: "ORACLE", baseUrl: "https://eeho.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/jobsearch" },
  { name: "Emerson Electric", atsPlatform: "ORACLE", baseUrl: "https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1" },
  { name: "Honeywell", atsPlatform: "ORACLE", baseUrl: "https://ibqbjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Honeywell" },

  // ═══════════════════════════════════════════════════════════════════════
  // SAP SuccessFactors
  // ═══════════════════════════════════════════════════════════════════════
  { name: "ExxonMobil", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career4.successfactors.com/career?company=exxonmobilP" },
  { name: "Halliburton", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career4.successfactors.com/career?company=HALprod" },
  { name: "Phillips 66", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career4.successfactors.com/career?company=Phillips66" },
  { name: "American Airlines", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career4.successfactors.com/career?company=americairP" },
  { name: "Dover Corporation", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career2.successfactors.eu/career?company=DOVER" },
  { name: "PACCAR", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career5.successfactors.eu/career?company=paccarinc" },
  { name: "Lincoln National", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career4.successfactors.com/career?company=TalentPerfMgt" },
  { name: "Paramount Global", atsPlatform: "SUCCESSFACTORS", baseUrl: "https://career41.sapsf.com/career?company=viacomcbsi" },

  // ═══════════════════════════════════════════════════════════════════════
  // SmartRecruiters
  // ═══════════════════════════════════════════════════════════════════════
  { name: "Visa", atsPlatform: "SMARTRECRUITERS", baseUrl: "https://api.smartrecruiters.com/v1/companies/Visa" },
  { name: "ServiceNow", atsPlatform: "SMARTRECRUITERS", baseUrl: "https://api.smartrecruiters.com/v1/companies/ServiceNow" },
  { name: "AbbVie", atsPlatform: "SMARTRECRUITERS", baseUrl: "https://api.smartrecruiters.com/v1/companies/AbbVie" },
  { name: "McDonald's", atsPlatform: "SMARTRECRUITERS", baseUrl: "https://api.smartrecruiters.com/v1/companies/McDonaldsCorporation" },
  // Palo Alto Networks removed — migrated to TalentBrew
  { name: "Public Storage", atsPlatform: "SMARTRECRUITERS", baseUrl: "https://api.smartrecruiters.com/v1/companies/publicstorage" },

  // ═══════════════════════════════════════════════════════════════════════
  // Eightfold AI
  // ═══════════════════════════════════════════════════════════════════════
  { name: "Microsoft", atsPlatform: "EIGHTFOLD", baseUrl: "https://microsoft.eightfold.ai?domain=microsoft.com" },
  { name: "Qualcomm", atsPlatform: "EIGHTFOLD", baseUrl: "https://qualcomm.eightfold.ai?domain=qualcomm.com" },
  { name: "Micron Technology", atsPlatform: "EIGHTFOLD", baseUrl: "https://micron.eightfold.ai?domain=micron.com" },
  { name: "HP Inc.", atsPlatform: "EIGHTFOLD", baseUrl: "https://hp.eightfold.ai?domain=hp.com" },
  { name: "Estee Lauder", atsPlatform: "EIGHTFOLD", baseUrl: "https://elcompanies.eightfold.ai?domain=elcompanies.com" },
  { name: "Boston Scientific", atsPlatform: "EIGHTFOLD", baseUrl: "https://bostonscientific.eightfold.ai?domain=bostonscientific.com" },
  { name: "Starbucks", atsPlatform: "EIGHTFOLD", baseUrl: "https://starbucks.eightfold.ai?domain=starbucks.com" },
  { name: "Deere & Company", atsPlatform: "EIGHTFOLD", baseUrl: "https://johndeere.eightfold.ai?domain=johndeere.com" },
  { name: "Freeport-McMoRan", atsPlatform: "EIGHTFOLD", baseUrl: "https://fcx.eightfold.ai?domain=fcx.com" },
];

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl && !dryRun) {
    console.error("ERROR: DATABASE_URL environment variable required (or use --dry-run)");
    process.exit(1);
  }

  // Count by platform
  const platformCounts = new Map<string, number>();
  for (const c of COMPANIES) {
    platformCounts.set(c.atsPlatform, (platformCounts.get(c.atsPlatform) || 0) + 1);
  }

  console.log(`\nSeed All Companies (${dryRun ? "DRY RUN" : "LIVE"})`);
  console.log(`${COMPANIES.length} companies to seed\n`);
  console.log("By platform:");
  for (const [platform, count] of [...platformCounts.entries()].sort()) {
    console.log(`  ${platform}: ${count}`);
  }
  console.log();

  if (dryRun) {
    console.log("Dry run -- no changes made to database\n");
    // List all companies
    for (const c of COMPANIES) {
      console.log(`  [${c.atsPlatform}] ${c.name}`);
    }
    return;
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    // Check existing companies
    const { rows: existing } = await pool.query("SELECT name FROM companies");
    const existingNames = new Set(existing.map((r: { name: string }) => r.name.toLowerCase()));

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const c of COMPANIES) {
      if (existingNames.has(c.name.toLowerCase())) {
        console.log(`  SKIP (exists): ${c.name}`);
        skipped++;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO companies (id, name, "atsPlatform", "baseUrl", enabled, "isRemoved", "scrapeStatus", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, true, false, 'PENDING', NOW(), NOW())
           ON CONFLICT (name) DO NOTHING`,
          [createId(), c.name, c.atsPlatform, c.baseUrl],
        );
        console.log(`  OK: ${c.name} [${c.atsPlatform}]`);
        inserted++;
      } catch (e: unknown) {
        console.error(`  FAIL: ${c.name}: ${(e as Error).message}`);
        failed++;
      }
    }

    console.log("\n==========================================");
    console.log("SUMMARY");
    console.log("==========================================");
    console.log(`Total:    ${COMPANIES.length}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped:  ${skipped} (already existed)`);
    console.log(`Failed:   ${failed}`);
    console.log("==========================================\n");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
