import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockTx } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockTx = {
    jobApplication: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  };
  const mockPrisma = {
    jobApplication: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  };
  return { mockAuth, mockPrisma, mockTx };
});

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "../[id]/duplicate/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(): Request {
  return new Request("http://localhost/api/kanban/applications/app1/duplicate", {
    method: "POST",
  });
}

describe("POST /api/kanban/applications/[id]/duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest(), makeParams("app1"));
    expect(res.status).toBe(401);
  });

  it("duplicates an application with new serial number", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      userId: "user1",
      company: "Acme",
      role: "PM",
      columnId: "col1",
      locationType: "Remote",
      primaryLocation: "NYC",
      additionalLocations: null,
      salaryMin: 100000,
      salaryMax: 150000,
      bonusTargetPct: 15,
      variableComp: null,
      hiringOrg: "Product",
      jobDescription: "JD text",
      referrals: "John Doe",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ applicationCap: 200, role: "USER" });
    mockPrisma.jobApplication.count.mockResolvedValue(1);

    mockTx.jobApplication.aggregate
      .mockResolvedValueOnce({ _max: { serialNumber: 1 } })
      .mockResolvedValueOnce({ _max: { columnOrder: 0 } });

    mockTx.jobApplication.create.mockResolvedValue({
      id: "app2",
      serialNumber: 2,
      company: "Acme",
      role: "PM",
      columnId: "col1",
    });

    const res = await POST(makeRequest(), makeParams("app1"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.serialNumber).toBe(2);
  });

  it("returns 403 when cap is reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      userId: "user1",
      company: "Acme",
      role: "PM",
      columnId: "col1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ applicationCap: 5, role: "USER" });
    mockPrisma.jobApplication.count.mockResolvedValue(5);

    const res = await POST(makeRequest(), makeParams("app1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent application", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeParams("fake"));
    expect(res.status).toBe(404);
  });
});
