---
bootstrapped_at: 2026-09-19T14:54:28Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: hamsta-date
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: hamsta-date
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: custom
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

HamstaDate is a solo, after-hours web-app MVP with a 3-week timeline that needs
email+password auth, a Postgres-backed data model (hamster profiles, matches,
messages), and a fast, cheap path to first deploy. The 10x Astro Starter
(Astro + React islands + TypeScript + Supabase + Cloudflare) covers auth,
database, and edge deployment out of the box, satisfies the solo user's stated
preference for React, and clears all four agent-friendly criteria (typed,
convention-based, popular in training data, well-documented). It was chosen
over T3 and Next.js after a direct framework comparison, since it bundles the
same needs with less manual wiring. Deployment defaults to Cloudflare Pages
per the starter's own default; CI runs on GitHub Actions with auto-deploy on
merge to main.

## Pre-scaffold verification

| Signal             | Value                                          | Severity | Notes                              |
| ------------------ | ----------------------------------------------- | -------- | ----------------------------------- |
| npm package        | not run                                         | n/a      | `cmd_template` starts with `git clone`; no npm package to resolve |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-09-12 | fresh    | from card `docs_url`               |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 21 top-level entries (`.husky`, `.vscode`, `node_modules`, `public`, `scripts`, `src`, `supabase`, `.env.example`, `.gitignore`, `.nvmrc`, `.prettierrc.json`, `AGENTS.md`, `astro.config.mjs`, `CLAUDE.md`, `components.json`, `eslint.config.js`, `package-lock.json`, `package.json`, `README.md`, `tsconfig.json`, `wrangler.jsonc`)
**Conflicts (.scaffold siblings)**: `.github` (cwd already had `.github`; scaffold copy landed at `.github.scaffold`)
**.gitignore handling**: moved silently (no `.gitignore` existed in cwd)
**.bootstrap-scaffold cleanup**: deleted (cloned `.git/` was removed before the move-up)

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: not applicable — 0 findings across 804 total dependencies (377 prod, 269 dev, 167 optional)

Clean audit tree; no findings to list.

## Hints recorded but not acted on

| Hint                       | Value                              |
| -------------------------- | ------------------------------------ |
| bootstrapper_confidence    | first-class                          |
| quality_override           | false                                 |
| path_taken                 | custom                                |
| self_check_answers         | null                                   |
| team_size                  | solo                                    |
| deployment_target          | cloudflare-pages                        |
| ci_provider                | github-actions                          |
| ci_default_flow            | auto-deploy-on-merge                    |
| has_auth                   | true                                     |
| has_payments               | false                                     |
| has_realtime               | false                                      |
| has_ai                     | true                                        |
| has_background_jobs        | false                                        |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review the `.github.scaffold` sibling the conflict policy created (compare against your existing `.github/`) and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the tree is currently clean (0 findings).
