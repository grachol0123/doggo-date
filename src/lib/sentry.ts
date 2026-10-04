import { captureException, withScope } from "@sentry/cloudflare";

export function captureServerFailure(error: unknown, route: string) {
  withScope((scope) => {
    scope.setTag("route", route);
    captureException(error);
  });
}
