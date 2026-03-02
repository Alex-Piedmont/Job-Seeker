import type { Role } from "@/generated/prisma/enums";

export function createMockUser(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
}> = {}) {
  return {
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    image: null,
    role: "USER" as Role,
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
}> = {}) {
  const user = createMockUser(overrides);
  return {
    user,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
