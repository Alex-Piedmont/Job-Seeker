import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockAuth, mockPrisma };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PUT } from "../route";

function callPut(id: string, body: Record<string, unknown>) {
  return PUT(
    new Request("http://localhost/api/admin/users/" + id + "/limits", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("PUT /api/admin/users/[id]/limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callPut("target1", { applicationCap: 10 });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
    const res = await callPut("target1", { applicationCap: 10 });
    expect(res.status).toBe(403);
  });

  it("returns 400 when admin tries to edit own limits", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    const res = await callPut("admin1", { applicationCap: 999 });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/own limits/i);
  });

  it("returns 400 when no cap is provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    const res = await callPut("target1", {});
    expect(res.status).toBe(400);
  });

  it("returns 400 when cap value is out of range", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    const res = await callPut("target1", { applicationCap: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 404 when target user does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await callPut("nonexistent", { applicationCap: 10 });
    expect(res.status).toBe(404);
  });

  it("updates applicationCap successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "target1", name: "Alice" });
    mockPrisma.user.update.mockResolvedValue({
      id: "target1",
      name: "Alice",
      applicationCap: 50,
      resumeGenerationCap: 5,
    });

    const res = await callPut("target1", { applicationCap: 50 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applicationCap).toBe(50);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "target1" },
        data: { applicationCap: 50 },
      })
    );
  });

  it("updates resumeGenerationCap successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "target1", name: "Bob" });
    mockPrisma.user.update.mockResolvedValue({
      id: "target1",
      name: "Bob",
      applicationCap: 25,
      resumeGenerationCap: 20,
    });

    const res = await callPut("target1", { resumeGenerationCap: 20 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resumeGenerationCap).toBe(20);
  });

  it("updates both caps at once", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin1", role: "ADMIN" } });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "target1", name: "Carol" });
    mockPrisma.user.update.mockResolvedValue({
      id: "target1",
      name: "Carol",
      applicationCap: 100,
      resumeGenerationCap: 50,
    });

    const res = await callPut("target1", {
      applicationCap: 100,
      resumeGenerationCap: 50,
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { applicationCap: 100, resumeGenerationCap: 50 },
      })
    );
  });
});
