import { test, expect } from "@playwright/test";

// Signed-out path: the seed's risk is the unauthenticated redirect itself, so
// it opts out of the saved session every other spec starts with.
test.use({ storageState: { cookies: [], origins: [] } });

// Seed — protects risk #1 (context/foundation/test-plan.md §2): unauthenticated
// access to protected dog/match/message surfaces must never return data, only
// a redirect. Verified to hold even with the Supabase backend unreachable
// (src/middleware.ts treats a missing/unusable session as signed-out).
test("unauthenticated request to a protected route redirects to sign-in, never shows data", async ({ page }) => {
  await page.goto("/dashboard");

  await page.waitForURL((url) => url.pathname === "/auth/signin");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  // No data created by this test — nothing to clean up.
});
