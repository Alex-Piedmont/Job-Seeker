import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    scrapedJob: {
      findUnique: vi.fn(),
    },
    userJobArchive: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST, DELETE } from "../[id]/archive/route";

function callArchive(id: string) {
  return POST(
    new Request(`http://localhost/api/scraped-jobs/${id}/archive`, { method: "POST" }),
    { params: Promise.resolve({ id }) }
  );
}

function callUnarchive(id: string) {
  return DELETE(
    new Request(`http://localhost/api/scraped-jobs/${id}/archive`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) }
  );
}

describe("POST /api/scraped-jobs/[id]/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callArchive("job1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when job does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findUnique.mockResolvedValue(null);

    const res = await callArchive("nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 409 when job is already archived", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findUnique.mockResolvedValue({ id: "job1" });
    mockPrisma.userJobArchive.findUnique.mockResolvedValue({
      id: "archive1",
      userId: "user1",
      scrapedJobId: "job1",
    });

    const res = await callArchive("job1");
    expect(res.status).toBe(409);
  });

  it("creates archive record successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.scrapedJob.findUnique.mockResolvedValue({ id: "job1" });
    mockPrisma.userJobArchive.findUnique.mockResolvedValue(null);
    mockPrisma.userJobArchive.create.mockResolvedValue({
      id: "archive1",
      userId: "user1",
      scrapedJobId: "job1",
    });

    const res = await callArchive("job1");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("archive1");
    expect(mockPrisma.userJobArchive.create).toHaveBeenCalledWith({
      data: { userId: "user1", scrapedJobId: "job1" },
    });
  });
});

describe("DELETE /api/scraped-jobs/[id]/archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callUnarchive("job1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when archive record does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.userJobArchive.findUnique.mockResolvedValue(null);

    const res = await callUnarchive("job1");
    expect(res.status).toBe(404);
  });

  it("removes archive record successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.userJobArchive.findUnique.mockResolvedValue({
      id: "archive1",
      userId: "user1",
      scrapedJobId: "job1",
    });
    mockPrisma.userJobArchive.delete.mockResolvedValue({});

    const res = await callUnarchive("job1");
    expect(res.status).toBe(204);
    expect(mockPrisma.userJobArchive.delete).toHaveBeenCalledWith({
      where: { userId_scrapedJobId: { userId: "user1", scrapedJobId: "job1" } },
    });
  });
});
