import { test, expect } from "@playwright/test";
import { signInViaApi } from "./helpers/api-sign-in";
import { runSql } from "./helpers/db-query";
import { messageOwnerA, messageOwnerB, MATCH_AB_ID } from "./fixtures/message-test-accounts";

// risk: test-plan.md #4 — "Real-time message delivery silently degrades to polling,
// or RLS lets a non-matched user read/write messages." This spec covers the realtime
// facet: a message sent by one matched owner must appear in the other matched owner's
// already-open thread without a reload. The RLS/cross-user-read facet is already
// proven at the database layer by supabase/tests/database/messages_rls.test.sql
// (pgTAP); its end-to-end UI consequence (not_participant boundary) is covered
// separately by message-unauthorized-access-blocked.spec.ts.
// seed: tests/e2e/seed.spec.ts (storageState / role-based-locator pattern).
//
// Runs against the dedicated, pre-matched A/B fixture pair from supabase/seed.sql
// (message-owner-a / message-owner-b, match id MATCH_AB_ID) so it never touches a
// real user's data and needs no swipe flow to establish the match.
test("a message sent by one matched owner appears live in the other owner's open thread", async ({
  browser,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const threadUrl = `/dashboard/messages/${MATCH_AB_ID}`;

  // Each matched owner gets their own isolated browser context, signed in via the
  // app's own /api/auth/signin endpoint (no UI login, no shared storageState — the
  // default shared identity can't cover two distinct, pre-matched identities at once).
  const contextA = await browser.newContext({ baseURL });
  const contextB = await browser.newContext({ baseURL });

  try {
    await signInViaApi(contextA, messageOwnerA.email, messageOwnerA.password);
    await signInViaApi(contextB, messageOwnerB.email, messageOwnerB.password);

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(threadUrl);
    await pageB.goto(threadUrl);

    // Both sides must be looking at the live thread (not an error/not_participant
    // state) before the realtime assertion means anything.
    await expect(pageA.getByRole("button", { name: "Wyślij wiadomość" })).toBeVisible();
    await expect(pageB.getByLabel("Nowa wiadomość")).toBeVisible();

    const uniqueBody = `E2E realtime delivery check ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await pageA.getByLabel("Nowa wiadomość").fill(uniqueBody);
    await pageA.getByRole("button", { name: "Wyślij wiadomość" }).click();

    // Sender's own optimistic append.
    await expect(pageA.getByText(uniqueBody)).toBeVisible();

    // The real assertion: B's already-open thread receives the message over the
    // Supabase Realtime channel, with no reload/navigation on B's side at all. A
    // regression to polling-only or a dropped subscription would time this out.
    await expect(pageB.getByText(uniqueBody)).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();

    // The messages table has no delete UI/API/RLS policy by design (chat history
    // is permanent), so the only way to remove this test's row is a direct,
    // asserted DB delete — the same trusted local-DB path supabase/seed.sql itself
    // uses, bypassing RLS deliberately for test-harness cleanup only.
    const deleted = runSql<{ id: string }>(
      `delete from public.messages where match_id = '${MATCH_AB_ID}' and body like 'E2E realtime delivery check %' returning id`,
    );
    expect(deleted.length).toBeGreaterThan(0);
  }
});
