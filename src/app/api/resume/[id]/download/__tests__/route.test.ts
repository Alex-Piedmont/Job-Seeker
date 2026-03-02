import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockMarkdownToDocx } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockPrisma = {
    resumeGeneration: {
      findFirst: vi.fn(),
    },
  };
  const mockMarkdownToDocx = vi.fn();
  return { mockAuth, mockPrisma, mockMarkdownToDocx };
});

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/docx-generator", () => ({
  markdownToDocx: (...args: unknown[]) => mockMarkdownToDocx(...args),
  sanitizeFilename: (company: string, role: string) =>
    `Resume-${company}-${role}`.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-"),
}));

import { GET } from "../route";

function callGet(id: string, query = "") {
  return GET(
    new Request(`http://localhost/api/resume/${id}/download${query}`),
    { params: Promise.resolve({ id }) }
  );
}

describe("GET /api/resume/[id]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await callGet("gen1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when generation not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.resumeGeneration.findFirst.mockResolvedValue(null);
    const res = await callGet("gen1");
    expect(res.status).toBe(404);
  });

  it("returns .docx with correct content type", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.resumeGeneration.findFirst.mockResolvedValue({
      id: "gen1",
      markdownOutput: "# Resume",
      jobApplication: { company: "Acme", role: "Dev" },
    });
    mockMarkdownToDocx.mockResolvedValue(Buffer.from("fake-docx"));

    const res = await callGet("gen1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(res.headers.get("Content-Disposition")).toContain("Resume-Acme-Dev.docx");
  });

  it("uses user-edited markdown when provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user1" } });
    mockPrisma.resumeGeneration.findFirst.mockResolvedValue({
      id: "gen1",
      markdownOutput: "# Original",
      jobApplication: { company: "Acme", role: "Dev" },
    });
    mockMarkdownToDocx.mockResolvedValue(Buffer.from("fake-docx"));

    const editedContent = "# Edited Resume";
    const encoded = Buffer.from(editedContent).toString("base64");
    await callGet("gen1", `?markdown=${encodeURIComponent(encoded)}`);

    expect(mockMarkdownToDocx).toHaveBeenCalledWith(editedContent);
  });
});
