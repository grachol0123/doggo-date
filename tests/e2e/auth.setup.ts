import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("sign in once and save the session", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error("Set E2E_USERNAME and E2E_PASSWORD (see context/foundation/test-stack.md, ## E2E)");
  }

  await page.goto("/auth/signin");
  // SignInForm is a React island (client:load); wait for it to hydrate before
  // the first input, since typing into it earlier is silently dropped.
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));

  // Signing in twice is harmless (no data is created), so retrying the whole
  // fill + submit is safe if the first attempt races the island's hydration.
  await expect(async () => {
    await page.getByLabel("Email").fill("");
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password", { exact: true }).fill("");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    // A successful sign-in redirects away from /auth/signin (to "/").
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/signin"), { timeout: 5_000 });
  }).toPass();

  // Confirm the session actually reaches a protected page: only a signed-in
  // user sees the dashboard sidebar's sign-out button instead of a redirect.
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
