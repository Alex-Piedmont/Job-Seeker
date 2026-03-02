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
      resumeEducation: {
        count: vi.fn(),
        create: vi.fn(),
        aggregate: vi.fn(),
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

import { PUT as ContactPUT } from "../contact/route";
import { POST as EducationPOST } from "../education/route";

const defaultParams = Promise.resolve({});

function mockAuthenticated() {
  mockAuth.mockResolvedValue({
    user: { id: "test-user-id", role: "USER" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

describe("Validation — Contact", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid JSON body", async () => {
    mockAuthenticated();
    const req = new Request("http://localhost/api/resume-source/contact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await ContactPUT(req, { params: defaultParams });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid JSON");
  });

  it("rejects LinkedIn URL without http", async () => {
    mockAuthenticated();
    mockPrisma.resumeSource.upsert.mockResolvedValue({ id: "rs-1" });

    const req = new Request("http://localhost/api/resume-source/contact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Test",
        email: "test@test.com",
        linkedIn: "linkedin.com/in/test",
      }),
    });
    const res = await ContactPUT(req, { params: defaultParams });
    expect(res.status).toBe(400);
  });

  it("trims whitespace from string fields", async () => {
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
      body: JSON.stringify({
        fullName: "  Alex  ",
        email: "  alex@test.com  ",
      }),
    });
    const res = await ContactPUT(req, { params: defaultParams });
    expect(res.status).toBe(200);
    expect(mockPrisma.resumeContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fullName: "Alex",
          email: "alex@test.com",
        }),
      })
    );
  });
});

describe("Validation — Education cap enforcement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when education cap (30) is reached", async () => {
    mockAuthenticated();
    mockPrisma.resumeSource.upsert.mockResolvedValue({ id: "rs-1" });
    mockPrisma.resumeEducation.count.mockResolvedValue(30);

    const req = new Request("http://localhost/api/resume-source/education", {
      method: "POST",
    });
    const res = await EducationPOST(req, { params: defaultParams });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Maximum of 30");
  });

  it("allows creation when under cap", async () => {
    mockAuthenticated();
    mockPrisma.resumeSource.upsert.mockResolvedValue({ id: "rs-1" });
    mockPrisma.resumeEducation.count.mockResolvedValue(5);
    mockPrisma.resumeEducation.aggregate.mockResolvedValue({
      _max: { sortOrder: 4 },
    });
    mockPrisma.resumeEducation.create.mockResolvedValue({
      id: "edu-1",
      institution: "",
      degree: "",
      sortOrder: 5,
    });

    const req = new Request("http://localhost/api/resume-source/education", {
      method: "POST",
    });
    const res = await EducationPOST(req, { params: defaultParams });
    expect(res.status).toBe(201);
  });
});
