---
project: Doggo Date
researched_at: 2026-09-19
recommended_platform: Cloudflare Workers/Pages
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript/JavaScript
  framework: Astro 7 (SSR) + React 19 islands
  runtime: Cloudflare Workers (workerd), via @astrojs/cloudflare
  realtime: Supabase Realtime (WebSockets, external to the hosting platform)
---

## Recommendation

**Deploy on Cloudflare Workers/Pages.**

The project is already wired for Cloudflare (`@astrojs/cloudflare` adapter configured in `astro.config.mjs`, deployment via `wrangler`), the developer is already familiar with the platform, and cost-minimization is the top interview priority — Cloudflare's free tier (100k requests/day) comfortably covers the PRD's expected scale (medium users, low QPS) at effectively $0/month. This run's interview clarified that the app itself does **not** need to host persistent connections — real-time messaging is delivered via Supabase Realtime, an external WebSocket service — so no platform was hard-filtered out this time. Cloudflare still scored 10/10 (Pass on all five agent-friendly criteria), the highest of any evaluated platform, with a stable scriptable deploy/rollback CLI (`wrangler deploy`, `wrangler rollback`) and GA markdown documentation (`developers.cloudflare.com/workers/llms.txt`), and remains the cheapest and most familiar option after cost-weighting.

## Platform Comparison

No hard filter applied this run: the developer confirmed the app does not need to host persistent server-side connections itself (interview Q1 = no — Supabase Realtime handles WebSockets externally). All six candidate platforms remained eligible for scoring.

| Platform       | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Raw score |
| -------------- | --------- | ------------------ | ------------------- | ----------------- | --------------- | --------- |
| **Cloudflare** | Pass      | Pass               | Pass                | Pass              | Pass            | **10/10** |
| Railway        | Pass      | Pass               | Pass                | Partial           | Pass            | 9/10      |
| Netlify        | Pass      | Pass               | Partial             | Partial           | Pass            | 8/10      |
| Fly.io         | Pass      | Pass               | Pass                | Partial           | Partial         | 8/10      |
| Render         | Pass      | Pass               | Partial             | Partial           | Partial         | 7/10      |
| Vercel         | Pass      | Pass               | Fail                | Partial           | Partial         | 6/10      |

Notes per platform:

- **Cloudflare**: `wrangler deploy`/`wrangler rollback`/`wrangler tail` are all GA and deterministic (`wrangler tail` requires the paid plan). Docs are published as GA markdown/llms.txt. Free tier (100k req/day) covers this MVP's expected traffic at $0/month. Cloudflare is actively steering new projects toward Workers rather than Pages (Pages is de facto in maintenance mode) — this project's existing `@astrojs/cloudflare` + `wrangler deploy` path already follows the recommended route.
- **Railway**: Strong all-round GA CLI, native long-lived-process support, official hosted MCP server (`mcp.railway.com`). Scored Partial on deploy API only because there's no dedicated `railway rollback` command (redeploy-by-ID is the documented workaround). No perpetual free tier — usage-based billing (~$10–20/month baseline for a small always-on service) makes it more expensive than Cloudflare, which weighs against the top interview priority (minimize cost).
- **Netlify**: GA Astro adapter, GA official MCP server (`@netlify/mcp`), cheap credits-based free tier (likely $0–9/month at this traffic level). Scored Partial on docs (product docs aren't on public GitHub, though CLI/MCP source is) and Partial on deploy API (no dedicated `netlify rollback` CLI command — done via UI "Publish Deploy" or API). Would require re-platforming from the currently-configured `@astrojs/cloudflare` adapter to `@astrojs/netlify`.
- **Fly.io**: Full Firecracker VMs give the strongest native persistent-process story, and docs are open-source markdown on GitHub (`superfly/docs`). Scored Partial on deploy API (no dedicated rollback command; redeploy via `fly deploy --image <prior>`) and Partial on MCP (`fly mcp launch` exists but carries no explicit GA/beta stability label). No perpetual free tier, but usage-based billing (~$2–8/month for a small always-on Node instance) is cheap; would require containerizing the app instead of using Cloudflare Workers.
- **Render**: GA CLI, but docs are rendered from a site rather than a public markdown/GitHub source (Partial), no dedicated rollback CLI command (Partial), and the MCP server/agent skills are newer and not formally graded (Partial). Free tier spins down after 15 minutes idle, unsuitable for production.
- **Vercel**: GA Astro adapter and Node runtime, but no public GitHub/MDX docs source was found (Fail), rollback and WebSocket support are both in public beta (Partial), and MCP integration is recent/GA-adjacent but unconfirmed (Partial). Hobby (free) tier explicitly disallows commercial use, so a for-profit MVP would need Pro (~$20/month), the most expensive option evaluated — conflicts with the top interview priority (minimize cost).

### Shortlisted Platforms

#### 1. Cloudflare Workers/Pages (Recommended)

Already the configured adapter and deployment target for this codebase (`@astrojs/cloudflare`, CI auto-deploy on merge per `AGENTS.md`/CI config). Perfect score on all five agent-friendly criteria, cheapest at this traffic level (free tier covers the PRD's expected scale), and matches the developer's stated Cloudflare familiarity. Requires no re-platforming.

#### 2. Netlify

Close second on cost (cheap credits-based free tier) and ships a GA official MCP server, matching Cloudflare on the "minimize cost" and integration priorities. Loses to Cloudflare mainly on docs openness (product docs not on public GitHub) and would require switching the Astro deployment adapter from Cloudflare to Netlify — a real migration cost this MVP doesn't need to pay given the existing wiring.

#### 3. Fly.io

Cheapest true always-on compute (~$2–8/month, billed by uptime not requests) and the strongest native persistent-process model of any evaluated platform, with fully open GitHub docs. Loses to Cloudflare and Netlify on requiring a full re-platform from serverless Workers to a Dockerized Node container — more operational surface than this 3-week MVP timeline justifies, especially since persistent connections aren't actually needed at the hosting layer (Supabase Realtime covers that).

## Anti-Bias Cross-Check: Cloudflare Workers/Pages

### Devil's Advocate — Weaknesses

1. Depending on two external services (Supabase Realtime + OpenRouter) that live outside Cloudflare's network means neither is co-located with the Worker; with a single-region user base (interview Q4) and no co-location preference (interview Q5), a Worker edge node distant from Supabase's fixed region could add noticeable per-message latency, undercutting the "instant delivery" promise in FR-006/NFR.
2. Cloudflare is actively steering new projects toward Workers instead of Pages (a "Are you sure you want to use Pages?" banner appears in the dashboard) — Pages is de facto in maintenance mode; if this project's `tech-stack.md` deployment target (`cloudflare-pages`) is followed literally rather than the already-configured `@astrojs/cloudflare` + `wrangler deploy` path, it could mean building against a deprecating product.
3. `wrangler tail` (live log tailing) requires the **paid** plan (billed by CPU time) — the free plan has no equivalent built-in way to stream production logs, complicating debugging of the Supabase/OpenRouter integration without upgrading.
4. CPU-time limits (10ms on the free plan) could be hit by long streaming responses from OpenRouter, forcing an earlier-than-planned move to the paid plan.
5. The Astro Cloudflare adapter requires the `nodejs_compat` compatibility flag in `wrangler.jsonc` for the Supabase client (which relies on Node built-ins) on compatibility dates before 2026-08-04. If this flag is missing or removed during a config change, Supabase calls fail silently at runtime, not at build time.

### Pre-Mortem — How This Could Fail

The team deployed Doggo Date on Cloudflare Workers' free plan, assuming that because Supabase Realtime handles WebSockets externally, the hosting platform itself needed no special configuration for "instant" messaging. A month in, cross-region latency between the Worker's edge location and Supabase's fixed database region turned out to be the dominant source of delay — exactly where the PRD promised instant delivery. Debugging was slow because `wrangler tail` required the paid plan, so the team flew blind for a week before anyone paid for observability. Separately, a `wrangler.jsonc` update accidentally dropped the `nodejs_compat` flag, causing silent 500 errors on every Supabase-backed endpoint over a weekend — unnoticed because the free plan has no built-in error alerting. When traffic spiked during a social-media mention, the team hit the free plan's CPU-time ceiling while streaming AI responses from OpenRouter, forcing a rushed mid-incident upgrade. In the end, this wasn't really a platform failure — it was underestimating how much of "instant" messaging depends on the network path between two external services, not just the hosting platform's own feature set.

### Unknown Unknowns

- The free plan has no built-in error/limit alerting — a silent failure (e.g. a dropped `nodejs_compat` flag) requires the team's own monitoring (e.g. Sentry) to catch.
- Real message latency depends on the physical distance between the Cloudflare edge node serving a request and Supabase's fixed database region — this is not something Cloudflare itself controls or surfaces, and is easy to overlook when evaluating "WebSocket support" purely at the platform level.
- Cloudflare is nudging new projects away from Pages toward Workers — a deployment-target mismatch between `tech-stack.md` (which says `cloudflare-pages`) and the actually-configured `@astrojs/cloudflare` adapter could cause confusion later if not reconciled.
- `compatibility_date` in `wrangler.jsonc` silently controls whether `nodejs_compat` is on by default (auto-enabled only for dates ≥ 2026-08-04) — easy to overlook when the project's pinned date predates that threshold.

## Operational Story

- **Preview deploys**: Cloudflare Pages/Workers generate a preview URL per branch/PR build automatically when connected via the GitHub integration; no extra protection step is required for this MVP's public-facing preview (add Cloudflare Access only if previews must be gated).
- **Secrets**: `SUPABASE_URL`/`SUPABASE_KEY`/`OPENROUTER_API_KEY` are set as Worker Secrets via `wrangler secret put <NAME>` (production) or in `.dev.vars` (local, gitignored); readable only by the deployed Worker at runtime, not visible in the dashboard once set. Rotate by re-running `wrangler secret put` with a new value.
- **Rollback**: `wrangler rollback [<VERSION_ID>]` reverts to a previously deployed version near-instantly; `wrangler versions` lists prior deployments. Note: rollback reverts code only — any Supabase schema migrations applied since the prior version do not automatically roll back.
- **Approval**: Routine deploys (`wrangler deploy` on merge to main via CI) may run unattended. A human must approve: rotating the primary Supabase service key, deleting the Cloudflare project/Worker, and any first-time domain/DNS changes.
- **Logs**: `wrangler tail` streams live production logs read-only from the terminal; `wrangler deployments list` / `wrangler versions list` inspect deployment history without any dashboard step.

## Risk Register

> **Resolution status (2026-09-20):** see `context/changes/deployment/deployment-plan.md` for how each risk below was actually addressed during the production deploy (Phases 0–6), including two bugs found and fixed that aren't in this original register: a stale `wrangler.jsonc` Worker `name` mismatch (Phase 2) and a Supabase CLI `--override-name` field-path error in CI (Phase 4).

| Risk                                                                                                                                                                                                    | Source                        | Likelihood | Impact | Mitigation                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-region latency between the Worker's edge node and Supabase's fixed database region undercuts "instant" message delivery (NFR/FR-006)                                                              | Devil's advocate / Pre-mortem | M          | M      | Pick/confirm a Supabase project region close to the target user base (single region per interview Q4); measure round-trip latency with `npm run smoke` against the deployed URL before relying on "instant" messaging in the PRD. |
| `wrangler tail` (live log tailing) requires the paid plan, leaving no built-in way to debug production issues on the free plan                                                                          | Devil's advocate / Pre-mortem | M          | M      | Budget for the $5/mo paid plan early if production debugging is expected, or add an external logging/error-tracking service (e.g. Sentry) that doesn't depend on Worker log tailing.                                              |
| Missing `nodejs_compat` flag silently breaks Supabase calls at runtime                                                                                                                                  | Devil's advocate / Pre-mortem | M          | H      | Pin `compatibility_date` and `compatibility_flags: ["nodejs_compat"]` explicitly in `wrangler.jsonc`; add a smoke test (`npm run smoke`) that exercises a Supabase-backed endpoint after every deploy.                            |
| Free plan has no built-in alerting for silent failures                                                                                                                                                  | Unknown unknowns              | M          | M      | Add lightweight external monitoring (e.g. Sentry or an uptime check hitting a Supabase-backed endpoint) before relying on the free plan in production.                                                                            |
| CPU-time limit (10ms free) hit during OpenRouter streaming responses                                                                                                                                    | Devil's advocate              | L          | M      | Monitor Worker CPU-time metrics; budget for the $5/mo paid plan (30M CPU-ms included) before/at first traffic spike rather than mid-incident.                                                                                     |
| `tech-stack.md` says `deployment_target: cloudflare-pages` while the project is actually configured for the `@astrojs/cloudflare` Workers adapter — Cloudflare is steering new projects away from Pages | Unknown unknowns              | L          | L      | Reconcile the deployment-target label in `tech-stack.md` with the actual Workers-based setup so future contributors/agents don't assume Pages-specific behavior.                                                                  |

## Getting Started

1. Confirm `wrangler.jsonc` has an explicit `compatibility_date` and, if that date is before 2026-08-04, add `"compatibility_flags": ["nodejs_compat"]` so the Supabase client resolves its Node built-ins correctly.
2. Confirm the Supabase project region is close to the target user base (single region per interview) to minimize latency for real-time messaging over Supabase Realtime.
3. Set production secrets: `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`, `npx wrangler secret put OPENROUTER_API_KEY` (repeat per secret; local dev uses `.dev.vars`).
4. Deploy: `npm run build && npx wrangler deploy`.
5. Verify: run `npm run smoke` (`BASE_URL` pointed at the deployed URL) to confirm the auth flow and a Supabase-backed request succeed end to end; use `npx wrangler tail` (paid plan) or an external error tracker if production log tailing is needed.
6. If a rollback is ever needed: `npx wrangler versions list` to find the prior version ID, then `npx wrangler rollback <VERSION_ID>`.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
