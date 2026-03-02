import { vi } from "vitest";

function createModelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  };
}

export function createMockPrisma() {
  return {
    resumeSource: createModelMock(),
    resumeContact: createModelMock(),
    resumeEducation: createModelMock(),
    resumeWorkExperience: createModelMock(),
    resumeWorkSubsection: createModelMock(),
    resumeSkill: createModelMock(),
    resumePublication: createModelMock(),
    $transaction: vi.fn(),
  };
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;
