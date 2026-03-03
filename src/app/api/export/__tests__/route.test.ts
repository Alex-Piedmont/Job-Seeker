import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    resumeSource: { findUnique: vi.fn() },
    kanbanColumn: { findMany: vi.fn() },
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
}));

import { GET } from "../route";

function callGet() {
  return GET(
    new Request("http://localhost/api/export"),
    { params: Promise.resolve({}) }
  );
}

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("returns export data with correct structure", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.resumeSource.findUnique.mockResolvedValue({
      contact: {
        fullName: "John Doe",
        email: "john@example.com",
        phone: null,
        location: null,
        linkedIn: null,
        website: null,
        summary: null,
      },
      education: [],
      experiences: [],
      skills: [],
      publications: [],
    });
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([
      {
        name: "Saved",
        color: "#4B5563",
        columnType: null,
        applications: [
          {
            serialNumber: 1,
            company: "Acme",
            role: "Engineer",
            hiringManager: null,
            hiringOrg: null,
            postingNumber: null,
            postingUrl: null,
            locationType: "Remote",
            primaryLocation: null,
            additionalLocations: null,
            salaryMin: 100000,
            salaryMax: 150000,
            bonusTargetPct: null,
            variableComp: null,
            referrals: null,
            datePosted: null,
            dateApplied: "2026-01-15T00:00:00.000Z",
            rejectionDate: null,
            closedReason: null,
            jobDescription: "Build things",
            createdAt: "2026-01-15T00:00:00.000Z",
            interviews: [],
            notes: [{ content: "Great company", createdAt: "2026-01-16T00:00:00.000Z" }],
            resumeGenerations: [],
          },
        ],
      },
    ]);

    const res = await callGet();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.exportedAt).toBeDefined();
    expect(body.resumeSource).not.toBeNull();
    expect(body.resumeSource.contact.fullName).toBe("John Doe");
    expect(body.columns).toHaveLength(1);
    expect(body.columns[0].name).toBe("Saved");
    expect(body.columns[0].applications).toHaveLength(1);
    expect(body.columns[0].applications[0].company).toBe("Acme");
    expect(body.columns[0].applications[0].notes).toHaveLength(1);
  });

  it("sets Content-Disposition header for download", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.resumeSource.findUnique.mockResolvedValue(null);
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([]);

    const res = await callGet();
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toMatch(/^attachment; filename="job-seeker-export-\d{4}-\d{2}-\d{2}\.json"$/);
  });

  it("handles null resume source gracefully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.resumeSource.findUnique.mockResolvedValue(null);
    mockPrisma.kanbanColumn.findMany.mockResolvedValue([]);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resumeSource).toBeNull();
    expect(body.columns).toEqual([]);
  });
});
