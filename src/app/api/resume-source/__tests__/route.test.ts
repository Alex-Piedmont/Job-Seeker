import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
    mockPrisma: {
      resumeSource: {
        upsert: vi.fn(),
      },
      resumeContact: {
        upsert: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, PUT } from "../route";
import { PUT as ContactPUT } from "../contact/route";

const defaultParams = Promise.resolve({});

function mockAuthenticated(userId = "test-user-id") {
  mockAuth.mockResolvedValue({
    user: { id: userId, role: "USER" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

describe("GET /api/resume-source", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), {
      params: defaultParams,
    });
    expect(res.status).toBe(401);
  });

  it("auto-creates and returns resume source", async () => {
    mockAuthenticated();
    const mockData = {
      id: "rs-1",
      userId: "test-user-id",
      contact: null,
      education: [],
      experiences: [],
      skills: [],
      publications: [],
    };
    mockPrisma.resumeSource.upsert.mockResolvedValue(mockData);

    const res = await GET(new Request("http://localhost"), {
      params: defaultParams,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("rs-1");
    expect(mockPrisma.resumeSource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "test-user-id" },
        create: { userId: "test-user-id" },
      })
    );
  });
});

describe("PUT /api/resume-source", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts resume source", async () => {
    mockAuthenticated();
    mockPrisma.resumeSource.upsert.mockResolvedValue({
      id: "rs-1",
      userId: "test-user-id",
    });

    const res = await PUT(new Request("http://localhost", { method: "PUT" }), {
      params: defaultParams,
    });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/resume-source/contact", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/resume-source/contact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Test", email: "test@test.com" }),
    });
    const res = await ContactPUT(req, { params: defaultParams });
    expect(res.status).toBe(401);
  });

  it("upserts contact info", async () => {
    mockAuthenticated();
    mockPrisma.resumeSource.upsert.mockResolvedValue({ id: "rs-1" });
    mockPrisma.resumeContact.upsert.mockResolvedValue({
      id: "c-1",
      fullName: "Alex",
      email: "alex@test.com",
    });

    const req = new Request("http://localhost/api/resume-source/contact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Alex", email: "alex@test.com" }),
    });

    const res = await ContactPUT(req, { params: defaultParams });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fullName).toBe("Alex");
  });
});
