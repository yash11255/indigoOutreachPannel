import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const AUTH_FILE = path.join(__dirname, ".auth/admin.json");

setup("authenticate as admin", async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD must be set in .env.local to run the E2E suite.",
    );
  }

  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/leads");
  await expect(page.getByRole("heading", { name: /leads/i })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
