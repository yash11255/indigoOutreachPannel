import { test, expect } from "@playwright/test";

/** Fills every field createLead() now requires (everything except SPOC contact) for a fresh "New lead" dialog already open on the page. TEST_ADMIN is an admin, so a Team must be picked too. */
async function fillMandatoryFields(
  page: import("@playwright/test").Page,
  dialog: import("@playwright/test").Locator,
  institutionName: string,
) {
  await dialog.getByRole("combobox", { name: "Team *" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByLabel("Institution name *").fill(institutionName);

  await dialog.getByRole("combobox", { name: "Region *" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("combobox", { name: "State *" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("combobox", { name: "District / City *" }).click();
  await page.getByRole("option", { name: "Other (specify)" }).click();
  await dialog.getByPlaceholder("Specify district/city…").fill("Test District");

  await dialog.getByRole("combobox", { name: "Outreach Pillar *" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("combobox", { name: "Outreach Channel *" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("combobox", { name: "Outreach Mode *" }).click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("combobox", { name: "Outreach Activity *" }).click();
  await page.getByRole("option").first().click();

  await dialog.getByLabel("Planned date *").fill("2026-08-01");
  await dialog.getByLabel("Total students *").fill("50");
  await dialog.getByLabel("Planned girls reach *").fill("25");
}

test.describe("leads pipeline", () => {
  test("table and kanban views render", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { level: 1, name: /leads/i })).toBeVisible();

    await page.getByRole("tab", { name: "Kanban" }).click();
    // Column headings, not the (potentially numerous) per-lead status badges
    // that also read "Planned"/"Completed" once there's real production data.
    await expect(page.getByRole("heading", { name: "Planned", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Completed", exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Table" }).click();
    await expect(page.locator("table")).toBeVisible();
  });

  test("creating a lead without the newly-mandatory fields is rejected", async ({ page }) => {
    const institutionName = `E2E Test Institution ${Date.now()}`;

    await page.goto("/leads");
    await page.getByRole("button", { name: "New lead" }).click();

    const dialog = page.getByRole("dialog");
    // Region/State/District/Pillar/Channel/Mode/Activity are Select-backed by
    // a hidden input, so the browser's native `required` can't enforce them —
    // that enforcement is server-side only. Fill every *natively*-required
    // field (so client-side validation doesn't block the submit first) but
    // deliberately skip Region, so the request reaches createLead() and its
    // own "Region is required." check is what rejects it.
    await dialog.getByRole("combobox", { name: "Team *" }).click();
    await page.getByRole("option").first().click();
    await dialog.getByLabel("Institution name *").fill(institutionName);
    await dialog.getByLabel("Planned date *").fill("2026-08-01");
    await dialog.getByLabel("Total students *").fill("50");
    await dialog.getByLabel("Planned girls reach *").fill("25");
    await dialog.getByLabel("Responsible member *").fill("E2E Test Runner");
    await dialog.getByRole("button", { name: "Create lead" }).click();

    await expect(dialog.getByText("Region is required.")).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toBeVisible();
  });

  test("create a lead, move it to execution, then delete it", async ({ page }) => {
    // The /leads/[id] route pulls in a lot of dialogs/components and can be
    // slow to compile on its first hit in a dev server, and every
    // revalidation on this page re-fetches the full (1000+ row) leads list —
    // give this one plenty of room so those don't flake it.
    test.setTimeout(150_000);
    const institutionName = `E2E Test Institution ${Date.now()}`;

    await page.goto("/leads");
    await page.getByRole("button", { name: "New lead" }).click();

    const dialog = page.getByRole("dialog");
    await fillMandatoryFields(page, dialog, institutionName);
    await dialog.getByLabel("Responsible member *").fill("E2E Test Runner");
    await dialog.getByRole("button", { name: "Create lead" }).click();

    // Check the actual outcome (the new lead lands in the list) rather than
    // the dialog's own exit-animation finishing — Base UI's close transition
    // can take several seconds to settle in headless Chromium, well past
    // when the underlying create has already succeeded. Search it out too:
    // with hundreds of real leads on this list, the row we want may be
    // sorted well below the fold, and a search filter is a more reliable way
    // to reach it than scrolling. Generous timeout: revalidating /leads means
    // re-fetching every lead (1000+ rows, paginated) from Supabase, which can
    // take a while against the real production dataset.
    await expect(page.getByRole("link", { name: institutionName })).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder("Search by institution, member, district, state…").fill(institutionName);
    await expect(page.getByRole("link", { name: institutionName })).toHaveCount(1);

    await page.getByRole("link", { name: institutionName }).click();
    await page.waitForURL("**/leads/*", { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: institutionName })).toBeVisible();

    await page.getByRole("button", { name: "Mark as executed" }).click();
    const execDialog = page.getByRole("dialog");
    await execDialog.getByLabel("Executed date *").fill("2026-08-02");
    await execDialog.getByRole("button", { name: "Mark as executed" }).click();
    await expect(page.getByText("Activity Completed")).toBeVisible({ timeout: 15_000 });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForURL("**/leads");
    await expect(page.getByRole("link", { name: institutionName })).toHaveCount(0);
  });
});
