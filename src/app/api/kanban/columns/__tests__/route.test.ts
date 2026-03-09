import { describe, it, expect, vi, beforeEach } from "vitest";

// Must use vi.hoisted for variables referenced in vi.mock factories
const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    kanbanColumn: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    jobApplication: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "../route";

const defaultParams = { params: Promise.resolve({}) };

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/kanban/columns", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/kanban/columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest(), defaultParams);
    expect(res.status).toBe(401);
  });

  it("returns existing columns", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    const columns = [
      { id: "col1", name: "Saved", order: 0, applications: [] },
    ];
    mockPrisma.kanbanColumn.findMany.mockResolvedValue(columns);

    const res = await GET(makeRequest(), defaultParams);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(columns);
  });

  it("auto-seeds default columns when none exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "col1", name: "Saved", applications: [] }]);
    mockPrisma.kanbanColumn.createMany.mockResolvedValue({ count: 6 });

    const res = await GET(makeRequest(), defaultParams);
    expect(res.status).toBe(200);
    expect(mockPrisma.kanbanColumn.createMany).toHaveBeenCalledOnce();
    expect(mockPrisma.kanbanColumn.createMany.mock.calls[0][0].data).toHaveLength(6);
  });
});

describe("POST /api/kanban/columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "Test", color: "#ff0000" }), defaultParams);
    expect(res.status).toBe(401);
  });

  it("creates a new column", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.count.mockResolvedValue(3);
    mockPrisma.kanbanColumn.aggregate.mockResolvedValue({ _max: { order: 2 } });
    mockPrisma.kanbanColumn.create.mockResolvedValue({
      id: "new-col",
      name: "Custom",
      color: "#ff0000",
      order: 3,
    });

    const res = await POST(makeRequest({ name: "Custom", color: "#ff0000" }), defaultParams);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Custom");
  });

  it("rejects when max 12 columns reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.kanbanColumn.count.mockResolvedValue(12);

    const res = await POST(makeRequest({ name: "Extra", color: "#ff0000" }), defaultParams);
    expect(res.status).toBe(400);
  });

  it("validates input — missing name", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    const res = await POST(makeRequest({ color: "#ff0000" }), defaultParams);
    expect(res.status).toBe(400);
  });

  it("validates input — invalid color", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    const res = await POST(makeRequest({ name: "Test", color: "notacolor" }), defaultParams);
    expect(res.status).toBe(400);
  });
});
