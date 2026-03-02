import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockTx } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockTx = {
    jobApplication: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    applicationStatusLog: {
      create: vi.fn(),
    },
  };
  const mockPrisma = {
    jobApplication: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    kanbanColumn: {
      findFirst: vi.fn(),
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

import { PUT } from "../../applications/move/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/kanban/applications/move", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/kanban/applications/move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(makeRequest({ id: "app1", columnId: "col2", newOrder: 0 }));
    expect(res.status).toBe(401);
  });

  it("moves card to different column and creates status log", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      userId: "user1",
      columnId: "col1",
      dateApplied: null,
    });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({
      id: "col2",
      userId: "user1",
      name: "Screening",
      columnType: null,
    });
    mockTx.jobApplication.update.mockResolvedValue({});
    mockTx.jobApplication.updateMany.mockResolvedValue({});
    mockTx.applicationStatusLog.create.mockResolvedValue({});
    mockPrisma.jobApplication.findUnique.mockResolvedValue({
      id: "app1",
      columnId: "col2",
      column: { id: "col2", name: "Screening", columnType: null },
    });

    const res = await PUT(
      makeRequest({ id: "app1", columnId: "col2", newOrder: 0 })
    );
    expect(res.status).toBe(200);
    expect(mockTx.applicationStatusLog.create).toHaveBeenCalledOnce();
  });

  it("auto-sets dateApplied when moving to Applied column", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      userId: "user1",
      columnId: "col1",
      dateApplied: null,
    });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({
      id: "col2",
      userId: "user1",
      name: "Applied",
      columnType: null,
    });
    mockTx.jobApplication.update.mockResolvedValue({});
    mockTx.jobApplication.updateMany.mockResolvedValue({});
    mockTx.applicationStatusLog.create.mockResolvedValue({});
    mockPrisma.jobApplication.findUnique.mockResolvedValue({
      id: "app1",
      columnId: "col2",
    });

    await PUT(makeRequest({ id: "app1", columnId: "col2", newOrder: 0 }));

    const updateCall = mockTx.jobApplication.update.mock.calls[0][0];
    expect(updateCall.data.dateApplied).toBeInstanceOf(Date);
  });

  it("sets rejection data when moving to CLOSED column", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({
      id: "app1",
      userId: "user1",
      columnId: "col1",
      dateApplied: new Date(),
    });
    mockPrisma.kanbanColumn.findFirst.mockResolvedValue({
      id: "col-closed",
      userId: "user1",
      name: "Closed",
      columnType: "CLOSED",
    });
    mockTx.jobApplication.update.mockResolvedValue({});
    mockTx.jobApplication.updateMany.mockResolvedValue({});
    mockTx.applicationStatusLog.create.mockResolvedValue({});
    mockPrisma.jobApplication.findUnique.mockResolvedValue({
      id: "app1",
      columnId: "col-closed",
    });

    await PUT(
      makeRequest({
        id: "app1",
        columnId: "col-closed",
        newOrder: 0,
        rejectionDate: "2026-03-01",
        closedReason: "ghosted",
      })
    );

    const updateCall = mockTx.jobApplication.update.mock.calls[0][0];
    expect(updateCall.data.rejectionDate).toBeInstanceOf(Date);
    expect(updateCall.data.closedReason).toBe("ghosted");
  });

  it("returns 404 for non-existent application", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue(null);

    const res = await PUT(
      makeRequest({ id: "fake", columnId: "col2", newOrder: 0 })
    );
    expect(res.status).toBe(404);
  });
});
