import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockGetUserUsage } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockGetUserUsage = vi.fn();
  return { mockAuth, mockGetUserUsage };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/resume-cap", () => ({
  getUserUsage: (...args: unknown[]) => mockGetUserUsage(...args),
}));

import { GET } from "../route";

function callGet() {
  return GET(
    new Request("http://localhost/api/resume/usage"),
    { params: Promise.resolve({}) }
  );
}

describe("GET /api/resume/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("returns usage for normal user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockGetUserUsage.mockResolvedValue({
      used: 3,
      cap: 5,
      resetsAt: new Date("2026-04-01"),
      isAdmin: false,
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.used).toBe(3);
    expect(body.cap).toBe(5);
    expect(body.isAdmin).toBe(false);
  });

  it("returns unlimited for admin user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1" } });
    mockGetUserUsage.mockResolvedValue({
      used: 50,
      cap: 5,
      resetsAt: null,
      isAdmin: true,
    });
    const res = await callGet();
    const body = await res.json();
    expect(body.isAdmin).toBe(true);
  });
});
