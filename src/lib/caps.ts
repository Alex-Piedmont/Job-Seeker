/**
 * Check if a user's monthly cap should be reset.
 * Caps reset on the first of each month (UTC).
 */
export function shouldResetCap(capResetAt: Date | null): boolean {
  if (!capResetAt) return true;

  const now = new Date();
  const resetDate = new Date(capResetAt);

  return now >= resetDate;
}

/**
 * Calculate the next cap reset date (first of next month, UTC midnight).
 */
export function getNextCapResetDate(): Date {
  const now = new Date();
  const year = now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const month = now.getUTCMonth() === 11 ? 0 : now.getUTCMonth() + 1;
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

/**
 * Check if a user has remaining resume generations this month.
 */
export function hasRemainingGenerations(used: number, cap: number): boolean {
  return used < cap;
}
