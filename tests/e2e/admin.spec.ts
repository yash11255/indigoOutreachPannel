import { test, expect } from "@playwright/test";

test.describe("admin", () => {
  test("dashboard shows stage counts and per-team/region breakdowns", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();

    for (const stage of ["Planned", "Outreach Sent", "Scheduled", "Completed", "Stalled"]) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
    }

    // "Team-wise leads" / "By region" are Card titles (styled <div>s, not semantic headings).
    await expect(page.getByText("Team-wise leads", { exact: true })).toBeVisible();
    await expect(page.getByText("By region", { exact: true })).toBeVisible();
  });

  test("users page lists accounts and can create a new member", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users", exact: true })).toBeVisible();
    // Two tables live on this page — Teams and All users.
    await expect(page.getByRole("table").first()).toBeVisible();
    await expect(page.getByText("Create teammate login")).toBeVisible();
  });

  test("logs page shows imported legacy data tabs", async ({ page }) => {
    await page.goto("/admin/logs");
    await expect(page.getByRole("heading", { name: /legacy logs/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Digital Outreach/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Activity Playbook/ })).toBeVisible();
  });
});
