import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockTx } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockTx = {
    jobApplication: {
      aggregate: vi.fn(),
      create: vi.fn(),
    },
    applicationStatusLog: {
      create: vi.fn(),
    },
  };
  const mockPrisma = {
    kanbanColumn: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    jobApplication: {
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

import { POST } from "../route";

const defaultParams = { params: Promise.resolve({}) };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/kanban/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/kanban/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset $transaction to use mockTx
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ company: "Acme", role: "PM", columnId: "col1" }), defaultParams);
    expect(res.status).toBe(401);
  });

  it("creates application with serial number 1 for first app", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({ id: "col1", userId: "user1", name: "Saved" });
    mockPrisma.user.findUnique.mockResolvedValue({ applicationCap: 200, role: "USER" });
    mockPrisma.jobApplication.count.mockResolvedValue(0);

    mockTx.jobApplication.aggregate
      .mockResolvedValueOnce({ _max: { serialNumber: null } })
      .mockResolvedValueOnce({ _max: { columnOrder: null } });

    const createdApp = {
      id: "app1",
      serialNumber: 1,
      company: "Acme",
      role: "PM",
      columnId: "col1",
    };
    mockTx.jobApplication.create.mockResolvedValue(createdApp);
    mockTx.applicationStatusLog.create.mockResolvedValue({});

    const res = await POST(makeRequest({ company: "Acme", role: "PM", columnId: "col1" }), defaultParams);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.serialNumber).toBe(1);
  });

  it("assigns serial #3 after #1 and #2 exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({ id: "col1", userId: "user1", name: "Saved" });
    mockPrisma.user.findUnique.mockResolvedValue({ applicationCap: 200, role: "USER" });
    mockPrisma.jobApplication.count.mockResolvedValue(2);

    mockTx.jobApplication.aggregate
      .mockResolvedValueOnce({ _max: { serialNumber: 2 } })
      .mockResolvedValueOnce({ _max: { columnOrder: 1 } });

    mockTx.jobApplication.create.mockResolvedValue({
      id: "app3",
      serialNumber: 3,
      company: "Gamma",
      role: "Eng",
      columnId: "col1",
    });
    mockTx.applicationStatusLog.create.mockResolvedValue({});

    const res = await POST(makeRequest({ company: "Gamma", role: "Eng", columnId: "col1" }), defaultParams);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.serialNumber).toBe(3);
  });

  it("returns 403 when cap is reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({ id: "col1", userId: "user1", name: "Saved" });
    mockPrisma.user.findUnique.mockResolvedValue({ applicationCap: 5, role: "USER" });
    mockPrisma.jobApplication.count.mockResolvedValue(5);

    const res = await POST(makeRequest({ company: "Too Many", role: "PM", columnId: "col1" }), defaultParams);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("limit");
  });

  it("allows admin to bypass cap", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({ id: "col1", userId: "user1", name: "Saved" });
    mockPrisma.user.findUnique.mockResolvedValue({ applicationCap: 5, role: "ADMIN" });
    mockPrisma.jobApplication.count.mockResolvedValue(5);

    mockTx.jobApplication.aggregate
      .mockResolvedValueOnce({ _max: { serialNumber: 5 } })
      .mockResolvedValueOnce({ _max: { columnOrder: 4 } });

    mockTx.jobApplication.create.mockResolvedValue({
      id: "app6",
      serialNumber: 6,
      company: "Admin Co",
      role: "Admin",
      columnId: "col1",
    });
    mockTx.applicationStatusLog.create.mockResolvedValue({});

    const res = await POST(makeRequest({ company: "Admin Co", role: "Admin", columnId: "col1" }), defaultParams);
    expect(res.status).toBe(201);
  });

  it("rejects invalid column", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ company: "Test", role: "PM", columnId: "fake-col" }), defaultParams);
    expect(res.status).toBe(404);
  });

  it("validates required fields", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    const res = await POST(makeRequest({ company: "", role: "PM", columnId: "col1" }), defaultParams);
    expect(res.status).toBe(400);
  });

  it("auto-sets dateApplied when column is Applied", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({ id: "col1", userId: "user1", name: "Applied" });
    mockPrisma.user.findUnique.mockResolvedValue({ applicationCap: 200, role: "USER" });
    mockPrisma.jobApplication.count.mockResolvedValue(0);

    mockTx.jobApplication.aggregate
      .mockResolvedValueOnce({ _max: { serialNumber: null } })
      .mockResolvedValueOnce({ _max: { columnOrder: null } });

    mockTx.jobApplication.create.mockResolvedValue({
      id: "app1",
      serialNumber: 1,
      company: "Acme",
      role: "PM",
      columnId: "col1",
      dateApplied: new Date(),
    });
    mockTx.applicationStatusLog.create.mockResolvedValue({});

    const res = await POST(makeRequest({ company: "Acme", role: "PM", columnId: "col1" }), defaultParams);
    expect(res.status).toBe(201);

    const createCall = mockTx.jobApplication.create.mock.calls[0][0];
    expect(createCall.data.dateApplied).toBeInstanceOf(Date);
  });
});
