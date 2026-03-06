import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { mockAuth, mockCompany } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockCompany = {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { mockAuth, mockCompany };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findMany: (...args: unknown[]) => mockCompany.findMany(...args),
      count: (...args: unknown[]) => mockCompany.count(...args),
      findFirst: (...args: unknown[]) => mockCompany.findFirst(...args),
      findUnique: (...args: unknown[]) => mockCompany.findUnique(...args),
      create: (...args: unknown[]) => mockCompany.create(...args),
      update: (...args: unknown[]) => mockCompany.update(...args),
      delete: (...args: unknown[]) => mockCompany.delete(...args),
    },
  },
}));
vi.mock("@/lib/admin", () => ({
  adminHandler: (handler: Function) => {
    return async (
      request: Request,
      { params }: { params: Promise<Record<string, string>> }
    ) => {
      const session = mockAuth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const resolvedParams = await params;
      return handler(request, {
        userId: session.user.id,
        params: resolvedParams,
      });
    };
  },
}));

import { GET, POST } from "../route";
import { PUT, DELETE } from "../[id]/route";

function callGet(query = "") {
  return GET(
    new Request(`http://localhost/api/admin/companies${query}`),
    { params: Promise.resolve({}) }
  );
}

function callPost(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) }
  );
}

function callPut(id: string, body: unknown) {
  return PUT(
    new Request(`http://localhost/api/admin/companies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

function callDelete(id: string) {
  return DELETE(
    new Request(`http://localhost/api/admin/companies/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) }
  );
}

const validCompanyBody = {
  name: "Acme Corp",
  atsPlatform: "GREENHOUSE",
  baseUrl: "https://boards.greenhouse.io/acme",
};

const sampleCompany = {
  id: "comp-1",
  name: "Acme Corp",
  atsPlatform: "GREENHOUSE",
  baseUrl: "https://boards.greenhouse.io/acme",
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("GET /api/admin/companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockReturnValue(null);
    const res = await callGet();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    mockAuth.mockReturnValue({ user: { id: "u1", role: "USER" } });
    const res = await callGet();
    expect(res.status).toBe(403);
  });

  it("returns paginated list of companies for admin", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockCompany.findMany.mockResolvedValue([sampleCompany]);
    mockCompany.count.mockResolvedValue(1);

    const res = await callGet("?page=1&limit=10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.companies).toHaveLength(1);
    expect(body.companies[0].name).toBe("Acme Corp");
    expect(body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });
});

describe("POST /api/admin/companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockReturnValue(null);
    const res = await callPost(validCompanyBody);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body (missing name)", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    const res = await callPost({ atsPlatform: "GREENHOUSE", baseUrl: "https://example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 409 for duplicate company name", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockCompany.findFirst.mockResolvedValue(sampleCompany);

    const res = await callPost(validCompanyBody);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("A company with this name already exists");
  });

  it("creates company successfully", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockCompany.findFirst.mockResolvedValue(null);
    mockCompany.create.mockResolvedValue(sampleCompany);

    const res = await callPost(validCompanyBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Acme Corp");
    expect(mockCompany.create).toHaveBeenCalledOnce();
  });
});

describe("PUT /api/admin/companies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when company not found", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockCompany.findUnique.mockResolvedValue(null);

    const res = await callPut("comp-999", { name: "New Name" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Company not found");
  });

  it("returns 409 when new name conflicts", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockCompany.findUnique.mockResolvedValue(sampleCompany);
    mockCompany.findFirst.mockResolvedValue({ id: "comp-2", name: "Other Corp" });

    const res = await callPut("comp-1", { name: "Other Corp" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("A company with this name already exists");
  });

  it("updates company successfully", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    const updated = { ...sampleCompany, name: "Acme Updated" };
    mockCompany.findUnique.mockResolvedValue(sampleCompany);
    mockCompany.findFirst.mockResolvedValue(null);
    mockCompany.update.mockResolvedValue(updated);

    const res = await callPut("comp-1", { name: "Acme Updated" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Acme Updated");
    expect(mockCompany.update).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/admin/companies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when company not found", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockCompany.findUnique.mockResolvedValue(null);

    const res = await callDelete("comp-999");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Company not found");
  });

  it("deletes company successfully", async () => {
    mockAuth.mockReturnValue({ user: { id: "admin1", role: "ADMIN" } });
    mockCompany.findUnique.mockResolvedValue(sampleCompany);
    mockCompany.delete.mockResolvedValue(sampleCompany);

    const res = await callDelete("comp-1");
    expect(res.status).toBe(204);
    expect(mockCompany.delete).toHaveBeenCalledOnce();
  });
});
