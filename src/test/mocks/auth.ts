import { vi } from "vitest";

export const mockAuth = vi.fn();

export function setupAuthMock() {
  vi.mock("@/lib/auth", () => ({
    auth: () => mockAuth(),
  }));
}

export function mockAuthenticated(userId = "test-user-id") {
  mockAuth.mockResolvedValue({
    user: { id: userId, role: "USER" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  });
}

export function mockUnauthenticated() {
  mockAuth.mockResolvedValue(null);
}
