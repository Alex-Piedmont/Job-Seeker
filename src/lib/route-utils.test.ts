import { describe, it, expect } from "vitest";
import { isPublicPath, isAdminPath } from "./route-utils";

describe("isPublicPath", () => {
  it("returns true for /signin", () => {
    expect(isPublicPath("/signin")).toBe(true);
  });

  it("returns true for /api/auth paths", () => {
    expect(isPublicPath("/api/auth/callback/google")).toBe(true);
    expect(isPublicPath("/api/auth/signin")).toBe(true);
  });

  it("returns false for /dashboard", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
  });

  it("returns false for /admin", () => {
    expect(isPublicPath("/admin")).toBe(false);
  });

  it("returns false for /applications", () => {
    expect(isPublicPath("/applications")).toBe(false);
  });

  it("returns false for root path", () => {
    expect(isPublicPath("/")).toBe(false);
  });
});

describe("isAdminPath", () => {
  it("returns true for /admin", () => {
    expect(isAdminPath("/admin")).toBe(true);
  });

  it("returns true for /admin/users", () => {
    expect(isAdminPath("/admin/users")).toBe(true);
  });

  it("returns true for /api/admin paths", () => {
    expect(isAdminPath("/api/admin/users")).toBe(true);
  });

  it("returns false for /dashboard", () => {
    expect(isAdminPath("/dashboard")).toBe(false);
  });

  it("returns false for /api/auth", () => {
    expect(isAdminPath("/api/auth")).toBe(false);
  });
});
