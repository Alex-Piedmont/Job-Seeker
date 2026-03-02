import { describe, it, expect } from "vitest";
import { isAdminEmail } from "./admin";

describe("isAdminEmail", () => {
  it("returns true for configured admin email", () => {
    expect(isAdminEmail("admin@test.com")).toBe(true);
  });

  it("returns false for non-admin email", () => {
    expect(isAdminEmail("user@example.com")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAdminEmail(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAdminEmail("")).toBe(false);
  });
});
