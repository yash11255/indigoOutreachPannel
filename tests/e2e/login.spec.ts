import { test, expect } from "@playwright/test";

test.describe("login", () => {
  test("unauthenticated visitors are redirected to /login", async ({ page }) => {
    await page.goto("/leads");
    await page.waitForURL("**/login");
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "nobody@example.com");
    await page.fill('input[name="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/invalid|error/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid credentials log in and redirect to /leads", async ({ page }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    test.skip(!email || !password, "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");

    await page.goto("/login");
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/leads");
    // level: 1 excludes the due-leads banner's own "N leads due..." <h2>, which
    // also matches /leads/i once there's a nonzero due count.
    await expect(page.getByRole("heading", { level: 1, name: /leads/i })).toBeVisible();
  });

  test("logging in again while already authenticated redirects away from /login", async ({
    browser,
  }) => {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;
    test.skip(!email || !password, "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set");

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/leads");

    await page.goto("/login");
    await page.waitForURL("**/leads");
    await context.close();
  });
});
