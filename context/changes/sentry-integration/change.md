---
change_id: sentry-integration
title: Integrate Sentry error tracking
status: implemented
created: 2026-10-04
updated: 2026-10-06
archived_at: null
---

## Notes

Completed 2026-10-06: all 11 verification items are checked in plan.md.
Production source-map resolution and actual email alert delivery were confirmed
by user screenshots. Temporary lesson page/API and their runtime flag were
removed after verification; Sentry capture and external JavaScript source maps
remain enabled.

Wdrożyć Sentry jako tracker błędów produkcyjnych. Motywacja: audyt obserwowalności
(/10x-observability-audit, uruchomiony 2026-10-04) wykazał, że w kodzie nie ma
żadnego SDK trackera błędów — jedyna ścieżka raportowania to `console.error`/
`console.warn` trafiające do logów Cloudflare Workers, bez alertowania.
`context/foundation/infrastructure.md` rekomendował Sentry jako zewnętrzny
monitoring, ale nigdy nie został wdrożony.

Zakres do ustalenia w /10x-plan: inicjalizacja SDK dla Astro 7 SSR na
Cloudflare Workers (`@sentry/astro` + adapter Cloudflare, lub `@sentry/cloudflare`
bezpośrednio), przechwytywanie błędów w middleware/API routes, DSN przez
`astro:env/server` (jak `SUPABASE_URL`/`SUPABASE_KEY`), tagowanie
release/environment, oraz zachowanie zgodności z RLS/prywatnością (brak PII
w zdarzeniach).
