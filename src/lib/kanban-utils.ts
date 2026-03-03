// ─── OTE Computation ────────────────────────────────────────────────────────

export function computeOTE(app: {
  salaryMax: number | null;
  bonusTargetPct: number | null;
  variableComp: number | null;
}): number | null {
  if (app.salaryMax == null) return null;
  const bonus = app.bonusTargetPct ? app.salaryMax * (app.bonusTargetPct / 100) : 0;
  const variable = app.variableComp ?? 0;
  return app.salaryMax + bonus + variable;
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
  updatedAt: string | Date;
  latestStatusLogAt?: string | Date | null;
  latestInterviewAt?: string | Date | null;
  latestNoteAt?: string | Date | null;
  columnType?: string | null;
}

export function getLastActivity(input: StaleCheckInput): Date {
  const dates = [new Date(input.updatedAt)];
  if (input.latestStatusLogAt) dates.push(new Date(input.latestStatusLogAt));
  if (input.latestInterviewAt) dates.push(new Date(input.latestInterviewAt));
  if (input.latestNoteAt) dates.push(new Date(input.latestNoteAt));
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

export function getStalenessLevel(
  input: StaleCheckInput,
  now: Date = new Date()
): StalenessLevel {
  // Terminal/positive states don't show staleness
  if (input.columnType === "CLOSED" || input.columnType === "OFFER") {
    return "none";
  }

  const lastActivity = getLastActivity(input);
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
