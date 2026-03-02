import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("unauthenticated user is redirected to /signin", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("sign-in page has Google sign-in button", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible();
  });

  test("sign-in page shows app name", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByRole("heading", { name: "Job Seeker" })).toBeVisible();
  });
});
