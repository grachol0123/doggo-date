import { defineMiddleware } from "astro:middleware";
import { SENTRY_TEST_ENABLED } from "astro:env/server";
import { captureServerFailure } from "@/lib/sentry";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/dashboard/dog", "/sentry-preview-test"];

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname.startsWith("/sentry-preview-test") && SENTRY_TEST_ENABLED !== "true") {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error && (error.status === undefined || error.status === 0 || error.status >= 500)) {
      captureServerFailure(error, "/middleware");
    }

    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
