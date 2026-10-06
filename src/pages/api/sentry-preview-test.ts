import type { APIRoute } from "astro";
import { SENTRY_TEST_ENABLED } from "astro:env/server";
import { z } from "zod";
import { captureServerFailure } from "@/lib/sentry";

export const prerender = false;

const testRequestSchema = z.object({ mode: z.enum(["handled", "uncaught"]) });
const headers = { "Cache-Control": "no-store" };

export const POST: APIRoute = async ({ request, url, locals }) => {
  if (SENTRY_TEST_ENABLED !== "true") {
    return new Response("Not found", { status: 404, headers });
  }

  if (!locals.user) {
    return Response.json({ status: "unauthenticated" }, { status: 401, headers });
  }

  if (request.headers.get("Origin") !== url.origin) {
    return Response.json({ status: "forbidden" }, { status: 403, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return Response.json({ status: "invalid" }, { status: 400, headers });
  }

  const parsed = testRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ status: "invalid" }, { status: 400, headers });
  }

  const error = new Error("Controlled Sentry lesson server test");
  if (parsed.data.mode === "handled") {
    error.name = "SentryHandledTestError";
    captureServerFailure(error, "/api/sentry-preview-test");
    return Response.json({ status: "controlled_handled_error" }, { status: 503, headers });
  }

  error.name = "SentryUncaughtTestError";
  throw error;
};
