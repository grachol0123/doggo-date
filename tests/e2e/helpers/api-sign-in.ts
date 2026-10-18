import type { BrowserContext } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Signs a browser context in without driving the UI, by posting directly to the
 * app's own /api/auth/signin endpoint (the same handler the sign-in form submits
 * to). Cookies set on the response land in `context`'s cookie jar, so any `page`
 * created afterwards is authenticated. Needed because tests/e2e/auth.setup.ts's
 * shared storageState only covers one identity, and these specs need several
 * independent, matched/unmatched identities signed in at once.
 */
export async function signInViaApi(context: BrowserContext, email: string, password: string) {
  const response = await context.request.post("/api/auth/signin", {
    form: { email, password },
    // A successful sign-in redirects to "/dashboard"; a failed one redirects back to
    // /auth/signin?error=... We only care that no error redirect happened.
    maxRedirects: 5,
  });

  expect(response.ok(), `sign-in for ${email} must succeed`).toBe(true);
  expect(new URL(response.url()).pathname, `sign-in for ${email} must not bounce back to /auth/signin`).not.toBe(
    "/auth/signin",
  );
}
