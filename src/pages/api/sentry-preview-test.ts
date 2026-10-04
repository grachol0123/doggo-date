import type { APIRoute } from "astro";
import { captureServerFailure } from "@/lib/sentry";

export const prerender = false;

const PREVIEW_HOST = "test-sentry-preview-browser-error-doggo-date.maciej-graszek.workers.dev";

export const POST: APIRoute = ({ url }) => {
  if (url.hostname !== PREVIEW_HOST) {
    return new Response(null, { status: 404 });
  }

  switch (url.searchParams.get("mode")) {
    case "handled":
      captureServerFailure(
        new Error("Controlled Sentry preview handled server capture test"),
        "/api/sentry-preview-test",
      );
      return new Response("Controlled handled server error", { status: 503 });
    case "uncaught":
      throw new Error("Controlled Sentry preview uncaught server capture test");
    default:
      return new Response("Use mode=handled or mode=uncaught", { status: 400 });
  }
};
