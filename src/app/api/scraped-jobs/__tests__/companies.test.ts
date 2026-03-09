import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    company: {
      findMany: vi.fn(),
    },
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "../companies/route";

const defaultParams = { params: Promise.resolve({}) };

describe("GET /api/scraped-jobs/companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/scraped-jobs/companies"), defaultParams);
    expect(res.status).toBe(401);
  });

  it("returns companies with job counts", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.company.findMany.mockResolvedValue([
      { id: "c1", name: "Acme", _count: { scrapedJobs: 42 } },
      { id: "c2", name: "Beta", _count: { scrapedJobs: 10 } },
    ]);

    const res = await GET(new Request("http://localhost/api/scraped-jobs/companies"), defaultParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.companies).toEqual([
      { id: "c1", name: "Acme", jobCount: 42 },
      { id: "c2", name: "Beta", jobCount: 10 },
    ]);
  });

  it("queries only enabled companies sorted by name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.company.findMany.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/scraped-jobs/companies"), defaultParams);

    expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enabled: true },
        orderBy: { name: "asc" },
      })
    );
  });
});
