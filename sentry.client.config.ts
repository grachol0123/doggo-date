import * as Sentry from "@sentry/astro";
import type { ErrorEvent } from "@sentry/astro";

function stripUrlQuery(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value, document.baseURI);
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

function scrubBrowserEvent(event: ErrorEvent) {
  event.user = undefined;
  event.request = undefined;
  event.contexts = undefined;
  event.extra = undefined;
  event.breadcrumbs = undefined;
  event.modules = undefined;
  event.server_name = undefined;
  event.tags = undefined;
  event.transaction = undefined;
  event.transaction_info = undefined;
  event.message = undefined;
  event.logentry = undefined;
  event.threads = undefined;
  event.spans = undefined;
  event.fingerprint = undefined;

  for (const exception of event.exception?.values ?? []) {
    exception.value = "Browser error";
    exception.mechanism = exception.mechanism ? { ...exception.mechanism, data: undefined } : undefined;

    for (const frame of exception.stacktrace?.frames ?? []) {
      frame.filename = stripUrlQuery(frame.filename);
      frame.abs_path = stripUrlQuery(frame.abs_path);
      frame.vars = undefined;
    }
  }

  for (const image of event.debug_meta?.images ?? []) {
    image.code_file = stripUrlQuery(image.code_file) ?? image.code_file;
  }

  return event;
}

const dsn: unknown = import.meta.env.PUBLIC_SENTRY_DSN;

if (typeof dsn === "string" && dsn.trim()) {
  const release = document.querySelector('meta[name="sentry-release"]')?.getAttribute("content");
  const environment = document.querySelector('meta[name="sentry-environment"]')?.getAttribute("content");

  Sentry.init({
    dsn,
    release: release?.trim() ? release : undefined,
    environment: environment?.trim() ? environment : undefined,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: scrubBrowserEvent,
  });
}
