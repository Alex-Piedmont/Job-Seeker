const US_STATE_ABBREVIATIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const US_KEYWORDS = [
  "united states",
  "remote",
  "u.s.",
  "usa",
];

const US_MAJOR_CITIES = [
  "new york", "los angeles", "chicago", "houston", "phoenix",
  "philadelphia", "san antonio", "san diego", "dallas", "san jose",
  "austin", "jacksonville", "san francisco", "seattle", "denver",
  "washington", "boston", "nashville", "portland", "las vegas",
  "atlanta", "miami", "minneapolis", "raleigh", "charlotte",
  "pittsburgh", "salt lake city",
];

export function isUSLocation(location: string): boolean {
  if (!location || location.trim() === "") return false;

  const lower = location.toLowerCase().trim();

  // Check keywords
  for (const keyword of US_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }

  // Check state abbreviations in multiple positions:
  // - After comma: "San Francisco, CA"
  // - End of string: "CA"
  // - Start of string: "CA Burbank Bldg. 700" (Workday format)
  const stateMatch = location.match(/,\s*([A-Z]{2})\b/)
    || location.match(/\b([A-Z]{2})$/)
    || location.match(/^([A-Z]{2})\s/);
  if (stateMatch && US_STATE_ABBREVIATIONS.has(stateMatch[1])) return true;

  // Check major cities
  for (const city of US_MAJOR_CITIES) {
    if (lower.includes(city)) return true;
  }

  return false;
}

/**
 * Inclusive wrapper for Workday list-level pre-filtering.
 * Returns true for empty/null/undefined (fetch detail to be safe)
 * and delegates to isUSLocation() for non-empty strings.
 */
export function isLikelyUSLocation(text: string | null | undefined): boolean {
  if (!text || text.trim() === "") return true;
  // Ambiguous multi-location markers (Workday: "2 Locations", "3 Locations")
  if (/^\d+\s+Locations?$/i.test(text)) return true;
  // Ambiguous placeholder
  if (text.trim().toLowerCase() === "n/a") return true;
  return isUSLocation(text);
}
