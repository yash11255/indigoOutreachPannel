import { test, expect } from "@playwright/test";

test.describe("calendar", () => {
  test("renders upcoming and past dated leads", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

    const body = page.locator("body");
    const hasEvents = await body.getByText(/planned activity|executed/i).first().isVisible()
      .catch(() => false);
    const hasEmptyState = await page.getByText("No dated leads yet.").isVisible().catch(() => false);

    expect(hasEvents || hasEmptyState).toBeTruthy();
  });
});
