import * as Sentry from "@sentry/cloudflare";
import type { CloudflareOptions } from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

const SAFE_ROUTES = new Set([
  "/",
  "/dashboard",
  "/dashboard/dog",
  "/dashboard/matches",
  "/auth/signin",
  "/auth/signup",
  "/auth/confirm-email",
  "/api/auth/signin",
  "/api/auth/signup",
  "/api/auth/signout",
  "/api/dogs/save",
  "/api/dogs/next-candidate",
  "/api/swipes",
  "/api/matches",
  "/api/messages",
  "/middleware",
]);

function safeRoute(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const candidate = value.replace(/^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+/i, "");
    const pathname = new URL(candidate, "https://sentry.invalid").pathname;

    if (SAFE_ROUTES.has(pathname)) {
      return pathname;
    }

    if (/^\/dashboard\/messages\/[^/]+\/?$/.test(pathname)) {
      return "/dashboard/messages/:matchId";
    }
  } catch {
    return undefined;
  }

  return undefined;
}

const scrubEvent: NonNullable<CloudflareOptions["beforeSend"]> = (event) => {
  const taggedRoute = typeof event.tags?.route === "string" ? safeRoute(event.tags.route) : undefined;
  const route = taggedRoute ?? safeRoute(event.request?.url) ?? safeRoute(event.transaction) ?? "/[route]";

  event.user = undefined;
  event.request = event.request ? { url: route } : undefined;
  event.transaction = event.transaction ? route : undefined;
  event.contexts = undefined;
  event.extra = undefined;
  event.breadcrumbs = undefined;
  event.modules = undefined;
  event.debug_meta = undefined;
  event.server_name = undefined;
  event.tags = { route };
  event.message = undefined;
  event.logentry = undefined;

  for (const exception of event.exception?.values ?? []) {
    exception.value = "Server error";

    for (const frame of exception.stacktrace?.frames ?? []) {
      frame.vars = undefined;
    }
  }

  return event;
};

function getOptionalBinding(env: unknown, name: "SENTRY_DSN" | "SENTRY_ENVIRONMENT") {
  if (typeof env !== "object" || env === null || !(name in env)) {
    return undefined;
  }

  const value: unknown = Reflect.get(env, name);

  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }

  return value;
}

function getVersionMetadataRelease(env: unknown) {
  if (typeof env !== "object" || env === null || !("CF_VERSION_METADATA" in env)) {
    return undefined;
  }

  const metadata: unknown = Reflect.get(env, "CF_VERSION_METADATA");

  if (typeof metadata !== "object" || metadata === null || !("id" in metadata)) {
    return undefined;
  }

  const release: unknown = Reflect.get(metadata, "id");
  return typeof release === "string" && release ? release : undefined;
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&"<>']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return "&#39;";
    }
  });
}

async function addSentryMetadata(response: Response, env: unknown) {
  const release = getVersionMetadataRelease(env);
  const environment = getOptionalBinding(env, "SENTRY_ENVIRONMENT");

  if ((!release && !environment) || !response.headers.get("content-type")?.match(/^text\/html\b/i)) {
    return response;
  }

  const metadata = [
    release && `<meta name="sentry-release" content="${escapeHtmlAttribute(release)}">`,
    environment && `<meta name="sentry-environment" content="${escapeHtmlAttribute(environment)}">`,
  ]
    .filter(Boolean)
    .join("");
  const html = await response.text();
  const updatedHtml = html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${metadata}`);
  const headers = new Headers(response.headers);

  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const releaseAwareHandler: typeof handler = {
  ...handler,
  fetch: async (request: Request, env: unknown, ctx: unknown) => {
    const response: unknown = await handler.fetch(request, env, ctx);
    if (!(response instanceof Response)) {
      throw new TypeError("Astro Cloudflare handler must return a Response");
    }

    return addSentryMetadata(response, env);
  },
};

export default Sentry.withSentry(
  (env: unknown) => ({
    dsn: getOptionalBinding(env, "SENTRY_DSN"),
    environment: getOptionalBinding(env, "SENTRY_ENVIRONMENT"),
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  }),
  releaseAwareHandler,
);
