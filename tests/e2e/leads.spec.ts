import { test, expect } from "@playwright/test";

test.describe("leads pipeline", () => {
  test("table and kanban views render", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible();

    await page.getByRole("tab", { name: "Kanban" }).click();
    await expect(page.getByText("Planned", { exact: true })).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Table" }).click();
    await expect(page.locator("table")).toBeVisible();
  });

  test("create a lead, move it to execution, then delete it", async ({ page }) => {
    const institutionName = `E2E Test Institution ${Date.now()}`;

    await page.goto("/leads");
    await page.getByRole("button", { name: "New lead" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Institution name *").fill(institutionName);
    await dialog.getByLabel("Planned date *").fill("2026-08-01");
    await dialog.getByRole("button", { name: "Create lead" }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: institutionName })).toBeVisible();

    await page.getByRole("link", { name: institutionName }).click();
    await page.waitForURL("**/leads/*");
    await expect(page.getByRole("heading", { name: institutionName })).toBeVisible();

    await page.getByRole("button", { name: "Move to execution" }).click();
    const execDialog = page.getByRole("dialog");
    await execDialog.getByLabel("Executed date *").fill("2026-08-02");
    await execDialog.getByRole("button", { name: "Move to execution" }).click();
    await expect(execDialog).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText("Activity Completed")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL("**/leads");
    await expect(page.getByRole("link", { name: institutionName })).toHaveCount(0);
  });
});
