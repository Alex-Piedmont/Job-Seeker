import type { AtsAdapter } from "./types.js";
import { GreenhouseAdapter } from "./greenhouse.js";
import { LeverAdapter } from "./lever.js";
import { WorkdayAdapter } from "./workday.js";
import { ICIMSAdapter } from "./icims.js";

const adapters: Record<string, AtsAdapter> = {
  GREENHOUSE: new GreenhouseAdapter(),
  LEVER: new LeverAdapter(),
  WORKDAY: new WorkdayAdapter(),
  ICIMS: new ICIMSAdapter(),
};

export function getAdapter(platform: string): AtsAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`Unsupported ATS platform: ${platform}`);
  }
  return adapter;
}
