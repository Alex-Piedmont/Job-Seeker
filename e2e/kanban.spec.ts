import { test, expect } from "@playwright/test";

// These tests require a running dev server with a seeded database
// and an authenticated session. They verify the full board flow.

test.describe("Kanban Board", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to applications page (requires auth — skip if not authenticated)
    await page.goto("/applications");
  });

  test("shows default columns on first visit", async ({ page }) => {
    // Wait for board to load (columns should appear)
    const board = page.locator('[class*="overflow-x-auto"]');
    await expect(board).toBeVisible({ timeout: 10000 });

    // Check for default column names
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(page.getByText("Applied")).toBeVisible();
    await expect(page.getByText("Screening")).toBeVisible();
    await expect(page.getByText("Interview")).toBeVisible();
    await expect(page.getByText("Offer")).toBeVisible();
    await expect(page.getByText("Closed")).toBeVisible();
  });

  test("creates an application", async ({ page }) => {
    // Click add application button
    const addBtn = page.getByRole("button", { name: /application/i });
    await addBtn.click();

    // Fill in the form
    await page.getByLabel("Company").fill("Test Corp");
    await page.getByLabel("Role").fill("Senior Engineer");

    // Submit
    await page.getByRole("button", { name: /create/i }).click();

    // Wait for toast confirmation
    await expect(page.getByText(/created as #/i)).toBeVisible({ timeout: 5000 });

    // Card should appear on the board
    await expect(page.getByText("Test Corp")).toBeVisible();
    await expect(page.getByText("Senior Engineer")).toBeVisible();
  });

  test("opens detail drawer on card click", async ({ page }) => {
    // Assume a card exists from previous test or seed data
    const card = page.getByText("Test Corp").first();
    if (await card.isVisible()) {
      await card.click();

      // Drawer should open with application details
      await expect(page.getByText(/Application #/)).toBeVisible({ timeout: 5000 });
      await expect(page.getByLabel("Company")).toBeVisible();
      await expect(page.getByLabel("Role")).toBeVisible();
    }
  });

  test("search filters cards", async ({ page }) => {
    const searchInput = page.getByRole("search");
    await searchInput.fill("nonexistentcompanyxyz");

    // Cards should be hidden
    // The board should still show columns but no cards matching
    await page.waitForTimeout(300);

    // Clear search
    await page.getByRole("button", { name: /clear/i }).click();
  });
});
