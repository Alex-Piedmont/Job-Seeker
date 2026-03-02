import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    jobApplication: {
      findFirst: vi.fn(),
    },
    applicationNote: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { POST } from "../[id]/notes/route";

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/kanban/applications/app1/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/kanban/applications/[id]/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ content: "Hello" }), makeParams("app1"));
    expect(res.status).toBe(401);
  });

  it("creates a note", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({ id: "app1", userId: "user1" });
    mockPrisma.applicationNote.count.mockResolvedValue(0);
    mockPrisma.applicationNote.create.mockResolvedValue({
      id: "note1",
      content: "Test note",
      createdAt: new Date().toISOString(),
    });

    const res = await POST(makeRequest({ content: "Test note" }), makeParams("app1"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.content).toBe("Test note");
  });

  it("rejects note over 5000 chars", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({ id: "app1", userId: "user1" });

    const longContent = "x".repeat(5001);
    const res = await POST(makeRequest({ content: longContent }), makeParams("app1"));
    expect(res.status).toBe(400);
  });

  it("rejects when max 500 notes reached", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue({ id: "app1", userId: "user1" });
    mockPrisma.applicationNote.count.mockResolvedValue(500);

    const res = await POST(makeRequest({ content: "One more" }), makeParams("app1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent application", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.jobApplication.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ content: "Test" }), makeParams("fake"));
    expect(res.status).toBe(404);
  });
});
