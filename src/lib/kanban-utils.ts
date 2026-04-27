// ─── OTE Computation ────────────────────────────────────────────────────────

export function computeOTE(app: {
  salaryMin: number | null;
  salaryMax: number | null;
  bonusTargetPct: number | null;
  variableComp: number | null;
}): number | null {
  if (app.salaryMin == null || app.salaryMax == null) return null;
  const midpoint = (app.salaryMin + app.salaryMax) / 2;
  const bonus = app.bonusTargetPct ? midpoint * (app.bonusTargetPct / 100) : 0;
  const variable = app.variableComp ?? 0;
  return midpoint + bonus + variable;
}

// ─── Currency Formatting ────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}k`;
  }
  return formatCurrency(amount);
}

// ─── Compensation Display ───────────────────────────────────────────────────

export function getCompensationDisplay(app: {
  salaryMin: number | null;
  salaryMax: number | null;
  bonusTargetPct: number | null;
  variableComp: number | null;
}): string | null {
  const ote = computeOTE(app);
  if (ote != null) {
    return `${formatCurrency(ote)} OTE`;
  }
  if (app.salaryMin != null && app.salaryMax != null) {
    return `${formatCompactCurrency(app.salaryMin)}-${formatCompactCurrency(app.salaryMax)}`;
  }
  if (app.salaryMin != null) {
    return `${formatCompactCurrency(app.salaryMin)}+`;
  }
  if (app.salaryMax != null) {
    return `up to ${formatCompactCurrency(app.salaryMax)}`;
  }
  return null;
}

// ─── Client-Side Search Filter ──────────────────────────────────────────────

export interface SearchableApplication {
  company: string;
  role: string;
  hiringManager: string | null;
  referrals: string | null;
}

export function matchesSearch(
  app: SearchableApplication,
  query: string
): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    app.company.toLowerCase().includes(q) ||
    app.role.toLowerCase().includes(q) ||
    (app.hiringManager?.toLowerCase().includes(q) ?? false) ||
    (app.referrals?.toLowerCase().includes(q) ?? false)
  );
}

// ─── Stale Card Detection ───────────────────────────────────────────────────

export type StalenessLevel = "none" | "muted" | "warning";

export interface StaleCheckInput {
  // When the card landed in its current column (latest status log into the
  // current column). Falls back to createdAt when the card has never moved.
  latestStatusLogAt?: string | Date | null;
  createdAt: string | Date;
  // Recruiter/interview activity that should refresh staleness for engagement
  // columns only (Screening, Interview).
  latestInterviewAt?: string | Date | null;
  latestNoteAt?: string | Date | null;
  columnName?: string | null;
  columnType?: string | null;
}

const ENGAGEMENT_COLUMN_NAMES = new Set(["Screening", "Interview"]);

export function getStalenessLevel(
  input: StaleCheckInput,
  now: Date = new Date()
): StalenessLevel {
  // Terminal/positive states don't show staleness
  if (input.columnType === "CLOSED" || input.columnType === "OFFER") {
    return "none";
  }

  // Time-in-stage: when the card entered its current column.
  // updatedAt is intentionally NOT used — it is touched by Prisma's @updatedAt
  // on unrelated row writes (e.g., columnOrder reorders), which would mask
  // genuine staleness.
  const stageStart = new Date(input.latestStatusLogAt ?? input.createdAt);
  let lastActivity = stageStart;

  // Engagement columns let recruiter notes and interview records refresh the
  // clock — ongoing dialogue or scheduled interviews mean the card is alive.
  if (input.columnName && ENGAGEMENT_COLUMN_NAMES.has(input.columnName)) {
    if (input.latestNoteAt) {
      const t = new Date(input.latestNoteAt);
      if (t > lastActivity) lastActivity = t;
    }
    if (input.latestInterviewAt) {
      const t = new Date(input.latestInterviewAt);
      if (t > lastActivity) lastActivity = t;
    }
  }

  const daysSinceActivity = Math.floor(
    (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity >= 30) return "warning";
  if (daysSinceActivity >= 14) return "muted";
  return "none";
}

// ─── Default Columns ────────────────────────────────────────────────────────

export const DEFAULT_COLUMNS = [
  { name: "Saved", order: 0, color: "#5991FF", columnType: null },
  { name: "Applied", order: 1, color: "#002060", columnType: null },
  { name: "Screening", order: 2, color: "#cc0099", columnType: null },
  { name: "Interview", order: 3, color: "#8b5cf6", columnType: null },
  { name: "Offer", order: 4, color: "#22c55e", columnType: "OFFER" },
  { name: "Closed", order: 5, color: "#ef4444", columnType: "CLOSED" },
] as const;
