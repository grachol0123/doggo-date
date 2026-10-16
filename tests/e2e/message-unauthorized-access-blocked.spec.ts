import { test, expect } from "@playwright/test";
import { signInViaApi } from "./helpers/api-sign-in";
import { messageOwnerC, MATCH_AB_ID } from "./fixtures/message-test-accounts";

// risk: test-plan.md #4 — "...or RLS lets a non-matched user read/write messages."
// This spec covers the route-level UI consequence of that boundary: a signed-in
// owner who isn't a participant in a match must see the not_participant state when
// navigating straight to its thread URL, and must never see any message content.
// The underlying DB-level RLS block is already proven directly by
// supabase/tests/database/messages_rls.test.sql (pgTAP); this spec proves the app's
// UI actually surfaces that block correctly end-to-end, which the pgTAP test and
// scripts/authz-test.mjs (no message/match route coverage) do not.
// seed: tests/e2e/seed.spec.ts (storageState / role-based-locator pattern).
//
// Uses the dedicated, deliberately-unmatched message-owner-c fixture (supabase/seed.sql)
// against the A/B match thread — read-only, so there is nothing to clean up.
test("a non-participant navigating to another pair's thread sees no message data", async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const context = await browser.newContext({ baseURL });

  try {
    await signInViaApi(context, messageOwnerC.email, messageOwnerC.password);
    const page = await context.newPage();

    await page.goto(`/dashboard/messages/${MATCH_AB_ID}`);

    await expect(page.getByRole("heading", { name: "Nie masz dostępu do tej rozmowy" })).toBeVisible();
    await expect(page.getByLabel("Nowa wiadomość")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Wyślij wiadomość" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
