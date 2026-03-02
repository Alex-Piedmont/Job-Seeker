import "@testing-library/jest-dom/vitest";

// Set default env vars for tests
process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long";
process.env.ADMIN_EMAILS = "admin@test.com";
