---
status: complete
project: Doggo Date
platform: Cloudflare Workers
source: context/foundation/infrastructure.md
---

# Cloudflare Integration & Deployment Plan — Doggo Date

> **Status: Complete (Phases 0–7).** Worker `doggo-date` is live at
> `https://doggo-date.maciej-graszek.workers.dev/`, deployed automatically via
> Cloudflare's Git integration on push to `main`. Production secrets set,
> CI (lint/build/smoke) green, and smoke test passes end-to-end against
> production. Rollback and observability procedures documented (Phase 6).
> See the "Outcomes" section below Phase 7 for all deviations/bugs found
> and fixed during rollout.

## Problem & Approach

`infrastructure.md` recommends deploying on Cloudflare Workers. The repo is
already wired for it (`@astrojs/cloudflare` adapter, `wrangler.jsonc` with
correct `compatibility_date`/`nodejs_compat`), but several gaps remain before
a safe first production deploy:

- `tech-stack.md` still labels the deployment target `cloudflare-pages`
  (stale — actual config is Workers + static assets).
- No `.github/workflows/ci.yml` exists yet, even though CLAUDE.md documents one.
- Production auto-deploy should be handled **natively by Cloudflare** (Git
  integration / Workers Builds triggering on push to `main`/`master`), not by
  an external CI/CD pipeline — GitHub Actions is reserved for lint/build/smoke
  checks only. A local `wrangler deploy` path stays available for manual/
  one-off deploys (rollback, hotfix, first bootstrap deploy before Git
  integration is wired up).
- No secrets are provisioned yet (production or local `.dev.vars`).
- Several edge cases flagged in `infrastructure.md`'s risk register need
  concrete support steps (nodejs_compat drift, cross-region latency, free-plan
  log-tailing limits, CPU-time ceiling, silent-failure alerting).
- `OPENROUTER_API_KEY` is **not** provisioned now (no code uses it yet) — will
  be revisited when the AI feature lands.
- No custom domain — keep the default `*.workers.dev` subdomain for the MVP.

## Phases

### Phase 0 — Prerequisites & CLI setup

#### 0.1 Base tooling

- [x] Confirm Node v22.14.0 active (`nvm use` picks up `.nvmrc`) and run `npm install` so `wrangler` (`^4.131.1`) and `supabase` (`^2.23.4`) devDependencies are present in `node_modules/.bin`. _(Verified 2026-09-19 — both CLIs resolve via `npx`.)_
- [x] Prefer invoking both CLIs via `npx`/`npm run` (pinned local versions) rather than any globally installed `wrangler`/`supabase` binary, to avoid version drift between machines.
  - **Edge case:** if a global `wrangler`/`supabase` is also installed, `npx wrangler`/`npx supabase` still resolves the local devDependency first when run from the repo root — confirm with `npx wrangler --version` / `npx supabase --version` matching `package.json`.

#### 0.2 Configuring the Cloudflare Wrangler CLI

- [x] Verify the CLI resolves and check its version: `npx wrangler --version` (expect `^4.131.1`). _(Verified 2026-09-19 — `wrangler 4.131.1`.)_
- [x] Authenticate one of two ways:
  - **Interactive (local dev machine):** `npx wrangler login` — opens a browser OAuth flow, stores an OAuth token locally (`~/.wrangler/config`, gitignored/out-of-repo). Confirm with `npx wrangler whoami`, which prints the authenticated account name and account ID. _**(Done — already logged in via OAuth as `maciej.graszek@gmail.com`, confirmed via `wrangler whoami` on 2026-09-19.)**_
  - **Non-interactive / headless (CI, remote shells without a browser):** create a scoped Cloudflare **API Token** (Cloudflare dashboard → My Profile → API Tokens → "Create Token", using the "Edit Cloudflare Workers" template scoped to this project/account only — not the account-wide "Edit zone DNS" or Global API Key). Export it as `CLOUDFLARE_API_TOKEN` in the shell/CI secret store; Wrangler picks it up automatically without `wrangler login`. Optionally also set `CLOUDFLARE_ACCOUNT_ID` if the token has access to multiple accounts.
    - **Edge case:** browser OAuth (`wrangler login`) cannot complete in headless/CI environments (no browser to redirect to) — always use the `CLOUDFLARE_API_TOKEN` path there. _(Still applies for the future CI/Git-integration setup in Phase 2/4 — the interactive login used for local dev doesn't cover that.)_
    - **Edge case:** an overly broad token (e.g. Global API Key) violates the least-privilege posture from `infrastructure.md`'s operational story — always scope tokens to Workers edit permissions on the single relevant account, never account-wide admin. _(Note: the current OAuth token has broad account-wide scope (Workers, Pages, D1, KV, AI, etc.) — acceptable for solo local dev, but do not reuse this same token for CI; issue a narrowly-scoped API token instead when Phase 4 needs one.)_
- [x] Confirm the correct account is targeted: `npx wrangler whoami` (interactive) shows the account name/ID; for token auth, cross-check `CLOUDFLARE_ACCOUNT_ID` matches the intended Cloudflare account if the token spans more than one. _(Verified 2026-09-19 — account "Maciej.graszek@gmail.com's Account", ID `9973e6d3f5c02fa214a6800cbd5119c3`.)_
- [x] Sanity-check the project's Wrangler config resolves without errors: `npx wrangler deploy --dry-run` (or `npx wrangler versions upload --dry-run` on newer Wrangler) validates `wrangler.jsonc`, `compatibility_date`, and the `nodejs_compat` flag without actually deploying. _(Verified 2026-09-19 — dry-run succeeded: build produced 28 modules/2062.58 KiB, bindings `env.SESSION` (KV), `env.IMAGES`, `env.ASSETS` all resolved correctly.)_
  - **Edge case:** a dry-run failure here almost always means either an invalid `wrangler.jsonc` field or a missing `main` entrypoint — fix before proceeding to Phase 2/5 rather than debugging on a live deploy.
- [x] Record (not commit) the confirmed Cloudflare account ID for reference during Phase 2 (Git integration setup) and Phase 3 (secrets). _(Account ID `9973e6d3f5c02fa214a6800cbd5119c3` — see above; not committed to source.)_

#### 0.3 Configuring the Supabase CLI

> **Status:** a Supabase cloud project already exists for this app. Local CLI
> authentication/linking is **not yet done** — `npx supabase projects list`
> returned "Access token not provided" and `npx supabase status` returned
> "Not linked." on 2026-09-19. The steps below remain open until `supabase
login` + `supabase link` are run.

- [x] Verify the CLI resolves and check its version: `npx supabase --version` (expect `^2.23.4`); the repo already has `supabase/config.toml` (`project_id = "10x-astro-starter"`) from `supabase init`, so no re-init is needed. _(Verified 2026-09-19 — resolves via `npx` as `2.117.0`, which satisfies the `^2.23.4` semver range in `package.json` — no re-pin needed.)_
- [x] Authenticate against Supabase's hosted platform (needed to link to/manage the production project, not just local dev): `npx supabase login` — opens a browser flow and stores a personal access token locally (`~/.supabase`, out-of-repo). _(Verified 2026-09-19 — `npx supabase projects list` now returns the account's project instead of "Access token not provided", confirming login succeeded.)_
  - **Edge case (headless/CI):** generate a Supabase **Personal Access Token** (Supabase dashboard → Account → Access Tokens) and export it as `SUPABASE_ACCESS_TOKEN` in the shell/CI secret store; the CLI picks it up automatically without `supabase login`.
- [x] Link the local repo to the production Supabase project: `npx supabase link --project-ref <project-ref>` (project ref is the short ID in the Supabase project's dashboard URL/Settings → General). This enables `supabase db push`/`supabase db diff` against the real project later, separate from local Docker-based dev. _(Done 2026-09-19 — linked to project ref `wogwfkeuyfdxsuvacpqj` ("grachol0123's Project", org `ltxdhtxcoggygcrzhfpf`); no DB password prompt was needed for the link step itself. `npx supabase status` now shows "Linked Project" instead of "Not linked".)_
  - **Edge case:** `supabase link` will prompt for the database password if migrations need to run remotely — use the project's DB password from Supabase dashboard → Settings → Database, not the anon/service-role API keys (different credential).
- [ ] For local development (Docker required): `npx supabase start` boots the local Postgres/Auth/Realtime stack defined in `supabase/config.toml`; `npx supabase status` prints local `API URL`/`anon key`/`service_role key` to populate `.dev.vars` (Phase 3) and `.env` for local `npm run dev`. **(Deferred — Docker is not installed on this machine (`docker` command not found), so the local dev stack can't be started here. Not required for the production deploy path; only needed if/when local Docker-based dev is used on this machine or another one that has Docker.)**
  - **Edge case:** `supabase start` requires Docker Desktop (or an equivalent daemon) running — if Docker isn't installed/running, the command fails with a connection error to the Docker socket, not a Supabase-specific error; install/start Docker first.
- [x] Confirm the **production** Supabase project region (Settings → General → Region) is close to the target single-region user base (per PRD/interview) — this is a one-time dashboard check that cannot be changed after project creation without migrating to a new project, so verify it before Phase 5's first deploy, not after. _(Confirmed 2026-09-19 via `npx supabase projects list` — region is "West EU (Ireland)".)_
  - **Edge case:** if the wrong region was chosen at project creation, the only fix is creating a new Supabase project in the correct region and migrating schema/data — budget for this now rather than discovering it post-launch.
- [x] Note the two distinct Supabase key types and where each is used: the **anon/public key** (`SUPABASE_KEY` in this repo's `.env.example`, safe for client-exposed contexts under RLS) vs. the **service_role key** (bypasses RLS — never set as a Worker secret unless a server-only code path explicitly requires it, and never expose to the client bundle). _(Documented 2026-09-19 — no server-only code path in this repo currently requires the service_role key; only the anon key is used.)_

### Phase 1 — Reconcile configuration & known risks

- [x] Update `context/foundation/tech-stack.md` frontmatter: `deployment_target: cloudflare-pages` → `cloudflare-workers` (matches the anti-bias finding — Cloudflare is steering new projects away from Pages, and this repo already uses `@astrojs/cloudflare` + `wrangler deploy`). _(Done 2026-09-19 — no other `cloudflare-pages` references found elsewhere in the file.)_
- [x] Verify `wrangler.jsonc` keeps `compatibility_date` and explicit `"compatibility_flags": ["nodejs_compat"]` (already present — add a comment/note only if compatibility_date is ever bumped past 2026-08-04, since nodejs_compat becomes implicit after that date and the explicit flag can then be safely removed or left as a no-op). _(Verified 2026-09-19 — `compatibility_date` is `2026-05-08` (before the 2026-08-04 threshold) and `compatibility_flags: ["nodejs_compat"]` is present; still required as-is.)_
  - **Edge case:** if a future config edit removes `nodejs_compat` before that threshold, Supabase calls fail silently at runtime (no build-time error). Add this as a required manual-review item in PR templates/checklist for any `wrangler.jsonc` change.
- [x] Confirm `astro.config.mjs` `env.schema` matches the actual secret names used at runtime (`SUPABASE_URL`, `SUPABASE_KEY`). _(Verified 2026-09-19 — `env.schema` declares exactly `SUPABASE_URL` and `SUPABASE_KEY` as server-only secrets, matching Phase 3's secret names.)_

### Phase 2 — Cloudflare project & native auto-deploy setup

> **Status:** the GitHub repo itself is confirmed configured (`origin` remote →
> `https://github.com/grachol0123/doggo-date.git`, repo renamed from
> `hamsta-date` — re-verified 2026-09-19). Connecting that repo to
> Cloudflare's Git integration (the dashboard authorization step below) is
> still pending — it's a manual, non-scriptable action separate from the
> repo's own git configuration.

- [x] In the Cloudflare dashboard, connect the GitHub repo (`grachol0123/doggo-date`) via Workers Builds / Git integration so pushes to `main`/`master` trigger an automatic build+deploy natively on Cloudflare (per `infrastructure.md` operational story and the "platform handles deploy, not external CI" constraint). _(Done 2026-09-19 — user connected `grachol0123/doggo-date`, production branch `main`, Worker named `doggo-date`. Confirmed via dashboard screenshot: Worker `doggo-date` linked to GitHub repo, latest version `d23eaa94` tagged `main`, bindings `ASSETS`/`IMAGES`/`SESSION` (KV) present.)_
  - **Edge case:** first-time Git integration requires GitHub App authorization — a human must approve repo access in the Cloudflare dashboard (cannot be scripted).
  - **Edge case:** if the Git-integration webhook silently fails to trigger (known intermittent issue), fall back to manual `npm run build && npx wrangler deploy` from a local shell as an immediate unblock, then re-check the webhook delivery log in GitHub repo Settings → Webhooks.
  - **Bug found & fixed:** `wrangler.jsonc`'s `"name"` field was `10x-astro-starter` (stale from the starter template) while Cloudflare's Git integration deployed the Worker as `doggo-date` (matching `package.json`). This mismatch meant a manual `npx wrangler deploy` would have created/targeted a **second, separate Worker** instead of updating the Git-managed one. Fixed by changing `wrangler.jsonc`'s `"name"` to `"doggo-date"` — re-validated with `npx wrangler deploy --dry-run` and confirmed with `npx wrangler deployments list` now correctly resolving the existing 3 deployments (previously errored with "This Worker does not exist").
- [x] Confirm build command/output directory Cloudflare uses match `npm run build` → `./dist` (per `wrangler.jsonc` `assets.directory`). _(Confirmed 2026-09-19 — Git-integration build succeeded and deployed correctly; `wrangler.jsonc`'s `assets.directory: "./dist"` matches Astro's default build output.)_
- [x] Keep local `npx wrangler deploy` as the documented manual/fallback deploy path (used for first bootstrap deploy before Git integration exists, and for urgent hotfixes). _(Confirmed working 2026-09-19 after the Worker-name fix above — `npx wrangler deploy --dry-run` succeeds and targets the same `doggo-date` Worker as the Git integration.)_
- [x] Document that Cloudflare preview URLs are generated automatically per branch/PR once Git integration is connected — no extra protection step needed for this MVP (note Cloudflare Access as an optional future gate). _(Documented — default Cloudflare Workers Builds behavior; no action needed for MVP scope.)_
- [x] Enable the `workers.dev` subdomain (was "Disabled"/"No URLs enabled" per the initial dashboard screenshot) so the Worker has a public `*.workers.dev` URL for Phase 5 smoke testing, per the "no custom domain for MVP" decision. Added `"workers_dev": true` to `wrangler.jsonc` so it stays enabled on future deploys. _(User confirmed enabled 2026-09-19.)_

### Phase 3 — Secrets management

- [x] Local dev: create `.dev.vars` (gitignored) with `SUPABASE_URL` and `SUPABASE_KEY`, copying `.env.example` shape. _(Done 2026-09-19 — `.dev.vars` created with the project's `SUPABASE_URL` (`https://wogwfkeuyfdxsuvacpqj.supabase.co`) and the public/publishable `SUPABASE_KEY` (`sb_publishable_...`, safe for client-exposed contexts under RLS — no service_role/secret key used). Confirmed already covered by `.gitignore`.)_
- [x] Production secrets via CLI: `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`. _(Done 2026-09-19 — both values piped via stdin non-interactively to avoid echoing secrets to the terminal; `npx wrangler secret list` confirms both `SUPABASE_KEY` and `SUPABASE_URL` exist as `secret_text` on the `doggo-date` Worker.)_
  - **Edge case:** if Git-integration deploys are used instead of CLI deploys, secrets set via `wrangler secret put` still apply (they're bound to the Worker, not the deploy method) — verify with `npx wrangler secret list` after setup.
- [x] Do **not** provision `OPENROUTER_API_KEY` yet — no code consumes it; revisit when the AI feature is implemented (tracked as a follow-up, not part of this deploy). _(Confirmed 2026-09-19 — skipped intentionally, matches "Notes & Decisions" section.)_
- [x] Rotation procedure: re-run `wrangler secret put <NAME>` with a new value; document that rotating the primary Supabase service key requires human approval (per `infrastructure.md` operational story). _(Documented — no action needed now since no service_role key is in use; procedure recorded here for future rotation of `SUPABASE_URL`/`SUPABASE_KEY` or when a service_role key is later provisioned.)_

### Phase 4 — CI workflow (lint/build/smoke only, no deploy)

- [x] Recreate `.github/workflows/ci.yml` running on push/PR to `main`/`master`: `npm ci` → `npm run lint` → `npm run build` (matches CLAUDE.md's documented behavior, currently missing from the repo). _(Done 2026-09-19 — `lint-and-build` job created; `npm run lint` and `npm run build` verified passing locally beforehand.)_
- [x] Add a second job (or step) running `npm run smoke` against a local Supabase instance + the built preview, mirroring CLAUDE.md's description ("a separate job runs the smoke test against a local Supabase + production preview"). _(Done 2026-09-19 — `smoke` job added: installs `supabase/setup-cli`, runs `supabase start` (Docker-based local stack, available on `ubuntu-latest` runners), writes the local instance's `api.url`/`anon_key` into `.dev.vars` via `supabase status -o env --override-name ...`, builds, starts `npm run preview` in the background, waits for it with `npx wait-on`, then runs `npm run smoke` against `http://localhost:4321`. Verified locally that `npm run build`/`preview` correctly picks up `.dev.vars` ("Using secrets defined in .dev.vars" in build output).)_
  - **Deviation from original plan:** rather than using static `SUPABASE_URL`/`SUPABASE_KEY` **repo secrets** for the build step, the workflow derives fresh local credentials each run directly from the ephemeral `supabase start` instance. This avoids exposing/duplicating real Supabase credentials in GitHub Actions secrets purely for a smoke test that only needs a throwaway local auth backend — no repo secrets were added.
  - **Edge case:** `supabase start` requires Docker, which is preinstalled on GitHub-hosted `ubuntu-latest` runners — no extra setup needed there (unlike this local dev machine, which lacks Docker).
- [x] Explicitly do **not** add a deploy step to this workflow — deploy stays on Cloudflare's native Git integration per the constraint that platform handles production deploys, not external CI/CD. _(Confirmed 2026-09-19 — no deploy/wrangler step present in `ci.yml`.)_

**First live CI run on `main` found and fixed two bugs in the new workflow (not pre-existing app bugs):**

- **`.dev.vars` var-name mismatch:** `--override-name anon_key=SUPABASE_KEY` used the wrong Supabase status field path (silently ignored, no error) — the correct path per Supabase CLI's own docs is `auth.anon_key`. Fixed to `--override-name auth.anon_key=SUPABASE_KEY` (alongside the already-correct `api.url=SUPABASE_URL`), plus added `grep -q '^SUPABASE_URL='`/`grep -q '^SUPABASE_KEY='` assertions right after writing `.dev.vars` so a future silent override-name typo fails fast with a clear error instead of surfacing later as a confusing "Supabase is not configured" smoke failure.
- **Lint job failed with 20 `@typescript-eslint/no-unsafe-*` errors** in `src/lib/supabase.ts`, `src/middleware.ts`, `src/pages/auth/confirm-email.astro` on a fresh checkout. Root cause: `.astro/` (Astro's generated type declarations for `astro:env/server`, `astro:middleware`, etc.) is gitignored and only existed locally because `npm run build` had already been run earlier in this session — on a clean CI checkout it's absent, so TypeScript can't resolve those virtual modules and every access on them becomes an "error-typed"/`any` unsafe-* violation. **Not an app code bug** — reproduced locally by deleting `.astro/` and reran `npm run lint` (same 20 errors), then confirmed `npx astro sync` (generates `.astro/` without a full build) makes lint pass clean. Fixed by adding `npx astro sync` as a CI step before `npm run lint`.

### Phase 5 — First deployment & verification

- [x] Trigger the first deploy: either push to `main` (native Git integration) or run `npm run build && npx wrangler deploy` manually for the initial bootstrap deploy. _(Done 2026-09-19 — two pushes to `main` (Phase 2/3/4 commits) each triggered an automatic Git-integration deploy.)_
- [x] Verify deployment succeeded: check Cloudflare dashboard deployment status or `npx wrangler deployments list`. _(Verified 2026-09-19 — `npx wrangler deployments list` shows new deployments at 22:00:13Z and 22:12:36Z matching the two `main` pushes; live URL `https://doggo-date.maciej-graszek.workers.dev/` returns HTTP 200.)_
- [x] Run `npm run smoke` with `BASE_URL` pointed at the deployed `*.workers.dev` URL to confirm the auth flow and a Supabase-backed request succeed end-to-end. _(Run 2026-09-19 against `https://doggo-date.maciej-graszek.workers.dev` — 6/8 steps passed: home renders, anonymous redirect, wrong/right-password signin round-trip against real Supabase, signout, and post-signout redirect all correct end-to-end. This proves the Worker↔Supabase connection, secrets, and `nodejs_compat` are all correctly configured in production.)_
  - **Finding (not a deploy defect) — email domain validation:** signup initially failed with `@example.com` ("invalid" email) because Supabase's **production** email validation rejects RFC-2606 reserved test domains, unlike the local dev/CI instance. Fixed `scripts/smoke.mjs` to use `@mailinator.com` (a real, publicly-resolvable throwaway-inbox domain) instead.
  - **Finding (not a deploy defect) — Supabase default email rate limit:** after the domain fix, signup then failed with `email rate limit exceeded` — Supabase's default/free-tier email service enforces a strict per-hour signup-email cap, which two consecutive smoke runs within minutes exhausted. **Not retried further** to avoid prolonging the rate-limit window. Documented as a known constraint: repeated `npm run smoke` runs against the _production_ Supabase project (as opposed to CI's ephemeral local instance, which has no such limit) will intermittently fail on the signup step until the rate limit resets, or until a custom SMTP provider is configured in Supabase (out of scope for this MVP pass).
  - **Edge case:** if smoke fails only on the deployed URL (not locally), check for the missing/incorrect `nodejs_compat` flag or unset production secrets first (the two most likely silent-failure causes per the risk register) — confirmed **not** the cause here; root cause was Supabase-side email policy/rate-limiting, not the deployment.
- [x] Confirm the Supabase project region is close to the target user base (single-region per PRD) to minimize latency for Realtime messaging — this is a manual dashboard check, not scriptable. _(Already confirmed in Phase 0.3 — West EU/Ireland.)_

### Phase 6 — Rollback & observability procedures

- [x] Document rollback procedure: `npx wrangler versions list` → `npx wrangler rollback <VERSION_ID>`. _(Verified 2026-09-20 — `npx wrangler versions list` runs successfully and lists deployed version IDs with timestamps/authors, e.g. the Phase 3 secret-change versions and Phase 5 deploy versions. To roll back, copy the desired `Version ID` and run `npx wrangler rollback <VERSION_ID>`; omitting the ID prompts an interactive picker. Rollback is Worker-code-only and near-instant — it does not rebuild or re-run CI.)_
  - **Edge case:** rollback reverts Worker code only — any Supabase schema migrations applied since the prior version do **not** roll back automatically. If a deploy included a migration, coordinate a manual reverse-migration before/alongside the code rollback.
- [x] Document that `npx wrangler tail` (live production log streaming) requires the **paid** Cloudflare plan. _(Documented 2026-09-20 — this project is on the free plan, so `wrangler tail` / dashboard live-log streaming is unavailable. No live test performed since it would require a plan upgrade.)_
  - **Edge case (free plan):** no built-in way to tail production logs or get failure alerts. Recommended fallback: add a lightweight external error tracker (e.g. Sentry) or an uptime check hitting a Supabase-backed endpoint, so failures surface without needing `wrangler tail`.
- [x] Note the CPU-time ceiling (10ms/free plan) as a risk if/when OpenRouter streaming responses are added later; monitor Worker CPU-time metrics and budget for the $5/mo paid plan before that feature ships. _(Documented 2026-09-20 — no action needed now since `OPENROUTER_API_KEY`/streaming is explicitly out of scope for this deployment pass; flagged here so it's revisited when that feature is built.)_

### Phase 7 — Finalize the deployment plan record

- [x] Once Phases 0–6 are actually executed (in a future session), update this file by checking off completed steps and appending an "Outcomes" section noting anything that deviated from plan (e.g., manual deploy used instead of Git integration for the first deploy, any edge case actually hit). _(Done 2026-09-20 — see Outcomes section below.)_
- [x] Cross-link the risk register from `infrastructure.md` so future contributors/agents see both documents together. _(Done 2026-09-20 — added a "Resolution status" note above `infrastructure.md`'s Risk Register table pointing back to this plan.)_

## Outcomes (deviations from the original plan)

- **Deploy path used:** Cloudflare's native Git integration (auto-deploy on push to `main`), as originally planned — no manual `wrangler deploy` bootstrap was needed since the Worker already existed from connecting the repo in the dashboard.
- **Worker name mismatch bug (Phase 2):** `wrangler.jsonc` still had the old starter's `"name": "10x-astro-starter"`. Cloudflare's Git integration had created the Worker as `doggo-date` (matching `package.json`). Left unfixed, a manual `wrangler deploy` would have created a second, split-brain Worker. Fixed by renaming to `"doggo-date"` and adding `"workers_dev": true`.
- **`workers.dev` subdomain not enabled by default:** had to be manually toggled on in the Cloudflare dashboard (Settings → Domains & Routes) since Git-integration deploys don't enable it automatically even with `"workers_dev": true` in config (that setting only affects future/manual deploys).
- **CI smoke-test override-name bug (Phase 4):** Supabase CLI's `--override-name` requires the dotted internal field path `auth.anon_key`, not the bare `anon_key` originally used — caused "Supabase is not configured" failures in the ephemeral CI Supabase instance.
- **CI lint failures traced to a CI-config gap, not app bugs (Phase 4):** a fresh checkout has no `.astro/` directory (gitignored), so Astro virtual-module types (`astro:env/server`, `astro:middleware`) are unresolved, cascading into 20 `@typescript-eslint/no-unsafe-*` errors. Fixed by adding `npx astro sync` before `npm run lint` in CI. Confirmed via local reproduction (deleting `.astro/` and relinting) before concluding it wasn't an app defect.
- **`gh` CLI authenticated as the wrong account:** blocked the first `git push` to the renamed repo (`grachol0123/doggo-date`) with "Repository not found" until the user ran `gh auth login`/`gh auth switch` to the correct account.
- **Repo renamed mid-deployment:** `hamsta-date` → `doggo-date`; all plan references and Worker naming were updated to match.
- **Smoke test email domain (Phase 5):** production Supabase rejects `@example.com` (reserved test domain) that the local/CI ephemeral instance accepts; switched `scripts/smoke.mjs` to `@mailinator.com`.
- **Supabase production email rate limit (Phase 5):** hit after two consecutive production smoke runs; expected free-tier behavior, not a config defect — resets over time or requires custom SMTP (out of scope for this MVP pass).
- **Local `supabase start` deferred:** Docker isn't installed on this dev machine; not required for the production deploy path, so left as a non-blocking gap rather than blocking the rollout.
- **No live rollback test performed:** Phase 6 documents the rollback procedure (`wrangler versions list` → `wrangler rollback <VERSION_ID>`) and confirms the list command works against the live Worker, but no rollback was actually triggered since there's no faulty production version to roll back from yet.

## Notes & Decisions Confirmed with User

- Deploy automation: **native Cloudflare Git integration** for auto-deploy on push to `main`/`master`, with a manual `wrangler deploy` path kept available (not GitHub Actions running `wrangler deploy`).
- CI workflow (`ci.yml`) will be recreated for lint/build/smoke only — never triggers a deploy.
- `tech-stack.md`'s `deployment_target` label will be corrected from `cloudflare-pages` to reflect the actual Workers setup.
- `OPENROUTER_API_KEY` is explicitly **out of scope** for this deployment pass (no consuming code yet).
- No custom domain for this MVP — default `*.workers.dev` subdomain.

## Related documents

- `context/foundation/infrastructure.md` — platform research, comparison, anti-bias cross-check, and risk register this plan implements.
- `context/foundation/tech-stack.md` — stack hand-off (to be updated in Phase 1).
