import { test, expect } from "@playwright/test";

// These tests require a running dev server with an authenticated session.

test.describe("Resume Source Guide", () => {
  test.beforeEach(async ({ page }) => {
    // Clear relevant localStorage keys before each test
    await page.goto("/resume-source");
    await page.evaluate(() => {
      localStorage.removeItem("resume-source-guide-seen");
      localStorage.removeItem("resume-source-nudge-dismissed");
    });
  });

  test("E2E-1: first visit auto-opens guide, dismiss persists, button reopens", async ({
    page,
  }) => {
    // Clear and reload to simulate first visit
    await page.evaluate(() =>
      localStorage.removeItem("resume-source-guide-seen")
    );
    await page.reload();

    // Modal should auto-open with step 1
    await expect(
      page.getByText("How to structure your experience")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Why structure matters")).toBeVisible();

    // Step through
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(/Before & After/i)).toBeVisible();

    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText("How to get started")).toBeVisible();

    // Click "Got it"
    await page.getByRole("button", { name: /got it/i }).click();

    // Modal should be closed
    await expect(
      page.getByText("How to structure your experience")
    ).not.toBeVisible();

    // Refresh — modal should NOT reopen
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("Why structure matters")
    ).not.toBeVisible({ timeout: 3000 });

    // Click the guide button to reopen
    await page
      .getByRole("button", { name: /how to structure your experience/i })
      .click();
    await expect(page.getByText("Why structure matters")).toBeVisible();
  });

  test("E2E-2: thinking prompt chips create subsection", async ({ page }) => {
    // Dismiss guide first
    await page.evaluate(() =>
      localStorage.setItem("resume-source-guide-seen", "true")
    );
    await page.reload();

    // Navigate to Work Experience tab
    await page.getByRole("tab", { name: /experience/i }).click();

    // Add experience
    await page.getByRole("button", { name: /add experience/i }).click();

    // Wait for new card — should be expanded with chips visible
    await expect(page.getByText("Projects I Led")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Problems I Solved")).toBeVisible();
    await expect(page.getByText("Growth & Impact")).toBeVisible();
    await expect(
      page.getByText("Collaboration & Leadership")
    ).toBeVisible();

    // Click a chip
    await page.getByText("Projects I Led").click();

    // Subsection should be created and expanded
    await expect(
      page.getByDisplayValue("Projects I Led")
    ).toBeVisible({ timeout: 5000 });

    // Chips should be gone
    await expect(page.getByText("Problems I Solved")).not.toBeVisible();
  });

  test("E2E-3: nudge banner shows and dismisses", async ({ page }) => {
    // Set guide as seen, nudge as not dismissed
    await page.evaluate(() => {
      localStorage.setItem("resume-source-guide-seen", "true");
      localStorage.removeItem("resume-source-nudge-dismissed");
    });
    await page.reload();

    // Navigate to Work Experience tab
    await page.getByRole("tab", { name: /experience/i }).click();

    // Need at least one experience with no subsections for banner
    // Add one if none exist
    const addBtn = page.getByRole("button", { name: /add experience/i });
    await addBtn.click();

    // Wait for experience to be created
    await expect(page.getByText("New Experience")).toBeVisible({
      timeout: 5000,
    });

    // Reload to see the nudge banner (it reads from state on mount)
    await page.reload();
    await page.getByRole("tab", { name: /experience/i }).click();

    // Banner should be visible
    await expect(
      page.getByText(/Organize your experience into subsections/i)
    ).toBeVisible({ timeout: 5000 });

    // Dismiss the banner
    await page.getByRole("button", { name: /dismiss/i }).click();

    // Banner should be gone
    await expect(
      page.getByText(/Organize your experience into subsections/i)
    ).not.toBeVisible();

    // Refresh — banner should stay dismissed
    await page.reload();
    await page.getByRole("tab", { name: /experience/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/Organize your experience into subsections/i)
    ).not.toBeVisible({ timeout: 3000 });
  });
});
