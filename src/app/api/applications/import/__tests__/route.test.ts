import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { mockAuth, mockScrapedJob, mockJobApplication, mockUser, mockKanbanColumn, mockStatusLog } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockScrapedJob: { findUnique: vi.fn() },
    mockJobApplication: {
      findFirst: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    mockUser: { findUnique: vi.fn() },
    mockKanbanColumn: { findFirst: vi.fn() },
    mockStatusLog: { create: vi.fn() },
  };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapedJob: {
      findUnique: (...args: unknown[]) => mockScrapedJob.findUnique(...args),
    },
    jobApplication: {
      findFirst: (...args: unknown[]) => mockJobApplication.findFirst(...args),
      count: (...args: unknown[]) => mockJobApplication.count(...args),
      aggregate: (...args: unknown[]) => mockJobApplication.aggregate(...args),
      updateMany: (...args: unknown[]) => mockJobApplication.updateMany(...args),
      create: (...args: unknown[]) => mockJobApplication.create(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUser.findUnique(...args),
    },
    kanbanColumn: {
      findFirst: (...args: unknown[]) => mockKanbanColumn.findFirst(...args),
    },
    applicationStatusLog: {
      create: (...args: unknown[]) => mockStatusLog.create(...args),
    },
    $transaction: vi.fn((fn: Function) => fn({
      jobApplication: {
        aggregate: (...args: unknown[]) => mockJobApplication.aggregate(...args),
        updateMany: (...args: unknown[]) => mockJobApplication.updateMany(...args),
        create: (...args: unknown[]) => mockJobApplication.create(...args),
      },
      applicationStatusLog: {
        create: (...args: unknown[]) => mockStatusLog.create(...args),
      },
    })),
  },
}));

import { POST } from "../route";

function callImport(body: unknown) {
  return POST(
    new Request("http://localhost/api/applications/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const sampleScrapedJob = {
  id: "sj-1",
  title: "Staff Engineer",
  url: "https://example.com/job/1",
  department: "Platform",
  locations: ["New York", "San Francisco"],
  locationType: "Remote",
  salaryMin: 200000,
  salaryMax: 300000,
  jobDescriptionMd: "# About the Role",
  company: { id: "c1", name: "TechCo" },
};

const sampleColumn = { id: "col-1", name: "Saved", order: 0 };
const sampleUser = { applicationCap: 200, role: "USER" };
const sampleCreatedApp = { id: "app-1", serialNumber: 1, company: "TechCo", role: "Staff Engineer" };

describe("POST /api/applications/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockReturnValue(null);
    const res = await callImport({ scrapedJobId: "sj-1" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid body (empty scrapedJobId)", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1" } });
    const res = await callImport({ scrapedJobId: "" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when scraped job not found", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1" } });
    mockScrapedJob.findUnique.mockResolvedValue(null);

    const res = await callImport({ scrapedJobId: "sj-999" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Scraped job not found");
  });

  it("returns 409 when job already imported", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1" } });
    mockScrapedJob.findUnique.mockResolvedValue(sampleScrapedJob);
    mockJobApplication.findFirst.mockResolvedValue({ id: "app-existing" });

    const res = await callImport({ scrapedJobId: "sj-1" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Job already imported");
    expect(body.applicationId).toBe("app-existing");
  });

  it("returns 403 when application cap reached (not admin)", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1" } });
    mockScrapedJob.findUnique.mockResolvedValue(sampleScrapedJob);
    mockJobApplication.findFirst.mockResolvedValue(null);
    mockUser.findUnique.mockResolvedValue({ applicationCap: 10, role: "USER" });
    mockJobApplication.count.mockResolvedValue(10);

    const res = await callImport({ scrapedJobId: "sj-1" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Application limit reached");
    expect(body.count).toBe(10);
    expect(body.cap).toBe(10);
  });

  it("returns 404 when saved column not found", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1" } });
    mockScrapedJob.findUnique.mockResolvedValue(sampleScrapedJob);
    mockJobApplication.findFirst.mockResolvedValue(null);
    mockUser.findUnique.mockResolvedValue(sampleUser);
    mockJobApplication.count.mockResolvedValue(5);
    mockKanbanColumn.findFirst.mockResolvedValue(null);

    const res = await callImport({ scrapedJobId: "sj-1" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Saved column not found");
  });

  it("successfully imports scraped job", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1" } });
    mockScrapedJob.findUnique.mockResolvedValue(sampleScrapedJob);
    mockJobApplication.findFirst.mockResolvedValue(null);
    mockUser.findUnique.mockResolvedValue(sampleUser);
    mockJobApplication.count.mockResolvedValue(5);
    mockKanbanColumn.findFirst.mockResolvedValue(sampleColumn);
    mockJobApplication.aggregate.mockResolvedValue({ _max: { serialNumber: 10 } });
    mockJobApplication.updateMany.mockResolvedValue({ count: 3 });
    mockJobApplication.create.mockResolvedValue(sampleCreatedApp);
    mockStatusLog.create.mockResolvedValue({});

    const res = await callImport({ scrapedJobId: "sj-1" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("app-1");
    expect(body.company).toBe("TechCo");
    expect(body.role).toBe("Staff Engineer");

    // Verify scraped job lookup included company
    expect(mockScrapedJob.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sj-1" }, include: { company: true } })
    );

    // Verify duplicate check
    expect(mockJobApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", scrapedJobId: "sj-1" } })
    );

    // Verify cap check
    expect(mockJobApplication.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );

    // Verify column lookup
    expect(mockKanbanColumn.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", order: 0 } })
    );

    // Verify transaction created the application
    expect(mockJobApplication.create).toHaveBeenCalledOnce();

    // Verify status log was created
    expect(mockStatusLog.create).toHaveBeenCalledOnce();
  });
});
